import { aiClient, type PlatformAdminActor } from './aiClient.js'
import { ApiError } from '../../utils/ApiError.js'
import { runAcrossOrganisations } from '../../platform/orgScope.js'
import { Tenant } from '../../models/index.js'

/**
 * What the assistant is allowed to have read.
 *
 * ## Generic or specific, and why that is the only knob
 *
 * A document is either the platform's or one company's. The platform's — a policy, a manual,
 * how a workflow is meant to run — is retrievable by everybody. A company's is retrievable by
 * that company and by nobody else, which is the whole reason the distinction exists: WIQAR's
 * veterinary procedure must never turn up in an answer given to somebody at WAYZ.
 *
 * The split is enforced twice, deliberately. This service refuses to name an organisation that
 * does not exist, and the AI service filters retrieval by scope on the way out. Neither trusts
 * the other to have done it.
 *
 * ## Why text rather than a file stream
 *
 * The AI service accepts a multipart upload, and this does not use it. The browser reads the
 * file it was given and posts the text, so Node forwards a JSON body instead of buffering a
 * stream only to re-encode it. The AI service's own documentation names this as the route the
 * web interface is expected to take.
 */

const asPlatform = (adminId: string, displayName: string): PlatformAdminActor => ({
  kind: 'PLATFORM_ADMIN',
  adminId,
  displayName,
})

/** The service credential these calls run under. A platform administrator has no organisation. */
const SERVICE_ACTOR = asPlatform('platform-console', 'Platform console')

export interface KnowledgeDocument {
  id: string
  title: string
  scope: 'GLOBAL' | 'TENANT'
  tenantId: string | null
  tenantName: string | null
  status: string
  chunks: number
  error: string | null
  createdAt: string
}

interface AiDocumentSummary {
  id?: string
  _id?: string
  title: string
  scope: string
  tenant_id: string | null
  tenant_name: string | null
  status: string
  chunk_count?: number
  error?: string | null
  created_at?: string
}

const present = (d: AiDocumentSummary): KnowledgeDocument => ({
  id: d.id ?? d._id ?? '',
  title: d.title,
  scope: d.scope === 'TENANT' ? 'TENANT' : 'GLOBAL',
  tenantId: d.tenant_id,
  tenantName: d.tenant_name,
  status: d.status,
  chunks: d.chunk_count ?? 0,
  error: d.error ?? null,
  createdAt: d.created_at ?? '',
})

/**
 * Checks that a named organisation is real, and returns what it is called.
 *
 * Read across organisations because this runs on a platform session, which is inside none of
 * them. It is a single `findById` on the unscoped `Tenant` collection — narrow on purpose.
 */
async function organisationNamed(organizationId: string) {
  const company = await runAcrossOrganisations(() =>
    Tenant.findById(organizationId, { name: 1 }).lean<{ _id: string; name: string } | null>(),
  )
  if (!company) throw ApiError.notFound(`There is no organisation called "${organizationId}".`)
  return company
}

export async function listKnowledgeDocuments(filter: { organizationId?: string } = {}) {
  const query = new URLSearchParams({ limit: '200' })
  if (filter.organizationId) {
    query.set('scope', 'TENANT')
    query.set('tenant_id', filter.organizationId)
  }

  const body = await aiClient.get<{ documents?: AiDocumentSummary[]; items?: AiDocumentSummary[] }>(
    SERVICE_ACTOR,
    `/documents?${query.toString()}`,
  )

  const documents = (body.documents ?? body.items ?? []).map(present)
  return {
    documents,
    generic: documents.filter((d) => d.scope === 'GLOBAL').length,
    specific: documents.filter((d) => d.scope === 'TENANT').length,
  }
}

export interface UploadKnowledgeInput {
  title: string
  /** Absent means generic — every organisation can retrieve it. */
  organizationId?: string
  text?: string
  sourceUrl?: string
  tags?: string[]
  filename?: string
  language?: string
  uploadedBy: string
}

export async function uploadKnowledgeDocument(input: UploadKnowledgeInput) {
  const text = input.text?.trim()
  if (!text) {
    throw ApiError.badRequest('Give the assistant something to read.', [
      'Paste the text, or attach a file the browser can read.',
    ])
  }

  const company = input.organizationId ? await organisationNamed(input.organizationId) : null

  const created = await aiClient.post<AiDocumentSummary>(SERVICE_ACTOR, '/documents', {
    title: input.title.trim(),
    content: text,
    scope: company ? 'TENANT' : 'GLOBAL',
    tenant_id: company?._id ?? null,
    tenant_name: company?.name ?? null,
    filename: input.filename ?? 'document.txt',
    language: input.language ?? 'ar',
    notes: [`Uploaded by ${input.uploadedBy}`, ...(input.tags ?? [])].join(' · ').slice(0, 1000),
  })

  return present(created)
}

export async function reindexKnowledgeDocument(id: string) {
  return aiClient.post<unknown>(SERVICE_ACTOR, `/documents/${encodeURIComponent(id)}/reindex`)
}

export async function deleteKnowledgeDocument(id: string) {
  return aiClient.remove<unknown>(SERVICE_ACTOR, `/documents/${encodeURIComponent(id)}`)
}

/** Whether the assistant is reachable at all, so the console can say so rather than fail oddly. */
export async function assistantHealth() {
  return aiClient.health()
}
