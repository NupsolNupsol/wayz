import { z } from 'zod'

import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { platformDb } from '../platform/connections.js'
import { platformActor, recordPlatformAudit } from '../platform/platformAuth.js'
import type { TenantRegistryDoc } from '../platform/registry.model.js'
import { ROLES } from '../domain/types.js'
import { aiClient, learningEnabled, type PlatformAdminActor } from '../services/learning/aiClient.js'

/**
 * Knowledge management, from the control plane.
 *
 * A super administrator decides which company a document belongs to, so this sits beside the
 * tenant registry rather than inside any tenant — and every route demands a platform session,
 * not a tenant one.
 *
 * The tenant named on an upload is checked against the registry here rather than being passed
 * through. That is the difference between "the administrator chose WIQAR" and "somebody typed
 * a string into a field called tenantId": a document can only be filed against a company that
 * actually exists and is not archived, and its name is taken from the registry row so the
 * badge in the UI cannot say one thing while the vector payload says another.
 */

const actorOf = (req: Parameters<typeof platformActor>[0]): PlatformAdminActor => {
  const admin = platformActor(req)
  return { kind: 'PLATFORM_ADMIN', adminId: admin.id, displayName: admin.fullName }
}

const MAX_DOCUMENT_CHARS = 400_000

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  /**
   * The file's text, read in the browser.
   *
   * Deliberately not a multipart proxy. These are hand-written `.txt` files of a few
   * kilobytes; having the browser read the file means this API validates a string it can
   * actually see rather than streaming bytes through to another service unexamined.
   */
  content: z.string().min(1, 'الملف فارغ.').max(MAX_DOCUMENT_CHARS),
  scope: z.enum(['GLOBAL', 'TENANT']),
  tenantId: z.string().trim().max(120).nullish(),
  filename: z
    .string()
    .trim()
    .max(200)
    .default('document.txt')
    // A filename is a label, never a path. Nothing here opens it, but it is stored and
    // displayed, and a value with a separator in it means the caller meant something else.
    .refine((v) => !/[\\/]|\.\./.test(v), 'اسم الملف غير صالح.')
    .refine((v) => /\.(txt|md)$/i.test(v), 'ارفع ملفاً نصياً بصيغة .txt'),
  allowedRoles: z.array(z.enum(ROLES)).max(ROLES.length).default([]),
  module: z.string().trim().max(60).default('GENERAL'),
  pageKey: z.string().trim().max(120).nullish(),
  language: z.string().trim().max(10).default('ar'),
  notes: z.string().trim().max(1000).default(''),
})

const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  content: z.string().min(1).max(MAX_DOCUMENT_CHARS).optional(),
})

function assertEnabled(): void {
  if (!learningEnabled()) {
    throw ApiError.unprocessable('The learning AI service is not configured on this server.', [
      'Set AI_SERVICE_SECRET and AI_SERVICE_URL, then start the learning-ai service.',
    ])
  }
}

/** The registry row for a tenant a document is being filed against, or a refusal. */
async function resolveTenant(tenantId: string): Promise<TenantRegistryDoc> {
  const { TenantRegistry } = platformDb()
  const row = await TenantRegistry.findById(tenantId).lean<TenantRegistryDoc>()
  if (!row) throw ApiError.notFound('No such tenant.')
  if (row.lifecycle === 'ARCHIVED') {
    throw ApiError.unprocessable('That tenant is archived and cannot receive new knowledge.')
  }
  return row
}

export const platformKnowledgeController = {
  /** What the upload form offers: the roles that exist, and the tenants a document can go to. */
  vocabulary: asyncHandler(async (_req, res) => {
    const { TenantRegistry } = platformDb()
    const tenants = await TenantRegistry.find({ isSynthetic: { $ne: true } })
      .select({ _id: 1, slug: 1, name: 1, lifecycle: 1 })
      .sort({ name: 1 })
      .lean<{ _id: string; slug: string; name: string; lifecycle: string }[]>()

    res.json({
      success: true,
      data: {
        enabled: learningEnabled(),
        roles: ROLES,
        tenants: tenants.map((t) => ({
          id: t._id,
          slug: t.slug,
          name: t.name,
          lifecycle: t.lifecycle,
        })),
      },
    })
  }),

  list: asyncHandler(async (req, res) => {
    assertEnabled()
    const scope = req.query.scope === 'TENANT' ? 'TENANT' : req.query.scope === 'GLOBAL' ? 'GLOBAL' : undefined
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined

    const params = new URLSearchParams()
    if (scope) params.set('scope', scope)
    if (tenantId) params.set('tenant_id', tenantId)
    params.set('limit', '200')

    res.json({
      success: true,
      data: await aiClient.get(actorOf(req), `/v1/documents?${params.toString()}`),
    })
  }),

  detail: asyncHandler(async (req, res) => {
    assertEnabled()
    res.json({
      success: true,
      data: await aiClient.get(actorOf(req), `/v1/documents/${encodeURIComponent(req.params.id)}`),
    })
  }),

  create: asyncHandler(async (req, res) => {
    assertEnabled()
    const body = createSchema.parse(req.body)
    const admin = platformActor(req)

    /*
     * The guard that makes the badge in the UI true.
     *
     * A global document must not carry a tenant and a tenant document must name one that
     * exists — so an administrator who picks the wrong toggle gets a refusal rather than a
     * company's private procedure published to every other company on the platform.
     */
    let tenantName: string | null = null
    if (body.scope === 'TENANT') {
      if (!body.tenantId) throw ApiError.badRequest('اختر الشركة التي تخصها هذه الوثيقة.')
      tenantName = (await resolveTenant(body.tenantId)).name
    } else if (body.tenantId) {
      throw ApiError.badRequest('A global document cannot be filed against a tenant.')
    }

    const created = await aiClient.post<{ id: string; status: string; chunk_count: number }>(
      actorOf(req),
      '/v1/documents',
      {
        title: body.title,
        content: body.content,
        scope: body.scope,
        tenant_id: body.scope === 'TENANT' ? body.tenantId : null,
        tenant_name: tenantName,
        filename: body.filename,
        allowed_roles: body.allowedRoles,
        module: body.module,
        page_key: body.pageKey || null,
        language: body.language,
        notes: body.notes,
      },
    )

    await recordPlatformAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'KNOWLEDGE_DOCUMENT_CREATED',
      tenantId: body.scope === 'TENANT' ? (body.tenantId ?? null) : null,
      detail: `${body.scope}: ${body.title} (${created.chunk_count} chunks, ${created.status})`,
    })

    res.status(201).json({ success: true, data: created })
  }),

  update: asyncHandler(async (req, res) => {
    assertEnabled()
    const body = updateSchema.parse(req.body)
    if (body.title === undefined && body.content === undefined) {
      throw ApiError.badRequest('Nothing to update.')
    }
    res.json({
      success: true,
      data: await aiClient.patch(
        actorOf(req),
        `/v1/documents/${encodeURIComponent(req.params.id)}`,
        body,
      ),
    })
  }),

  reindex: asyncHandler(async (req, res) => {
    assertEnabled()
    res.json({
      success: true,
      data: await aiClient.post(
        actorOf(req),
        `/v1/documents/${encodeURIComponent(req.params.id)}/reindex`,
      ),
    })
  }),

  remove: asyncHandler(async (req, res) => {
    assertEnabled()
    const admin = platformActor(req)
    const data = await aiClient.remove(
      actorOf(req),
      `/v1/documents/${encodeURIComponent(req.params.id)}`,
    )
    await recordPlatformAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'KNOWLEDGE_DOCUMENT_DELETED',
      detail: req.params.id,
    })
    res.json({ success: true, data })
  }),

  analytics: asyncHandler(async (req, res) => {
    assertEnabled()
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : ''
    const params = new URLSearchParams({ days: String(days) })
    if (tenantId) params.set('tenant_id', tenantId)
    res.json({
      success: true,
      data: await aiClient.get(actorOf(req), `/v1/analytics?${params.toString()}`),
    })
  }),

  /** Readiness of the AI stack, for the control plane's health screen. Never throws. */
  health: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await aiClient.health() })
  }),
}
