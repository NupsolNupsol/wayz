import { z } from 'zod'

import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { dropTenantDatabase, platformDb } from '../platform/connections.js'
import { platformActor, platformSignIn, recordPlatformAudit } from '../platform/platformAuth.js'
import { assertUsableSlug, createTenant, provisionTenant } from '../platform/provisioning.service.js'
import { forgetTenant } from '../platform/tenantContext.js'
import { CAPABILITIES, PLATFORM_PROFILES } from '../platform/capabilities.js'
import type { TenantRegistryDoc } from '../platform/registry.model.js'
import { env } from '../config/env.js'
import { runInTenant } from '../platform/tenantContext.js'
import { User } from '../models/index.js'
import { seededDemoLoginsFor } from '../platform/demoLogins.js'
import { Kiosk, RoleDefinition } from '../models/index.js'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '../models/user.model.js'
import { healthReport, platformOverview, platformReports } from '../platform/operations.service.js'

/**
 * A colour the browser will actually accept.
 *
 * Branding is written by a person into a form and then interpolated into a stylesheet, so
 * "whatever they typed" is not good enough: a value that is not a colour either breaks the
 * page silently or, worse, escapes the property it was meant to set. Three or six hex
 * digits, and nothing else, is the whole vocabulary the design tokens need.
 */
const hex = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour such as #1a3470.')

/**
 * A logo, held as a data URI.
 *
 * Deliberately not a file path or an upload directory. A tenant's logo has to appear on a
 * login page served before any tenant is resolved, on invoices rendered in a worker, and on
 * a control-plane screen that touches no tenant database — so the simplest correct home is
 * the registry row itself, which every one of those already reads. The size cap is what
 * keeps that honest: a logo is a small image, and anything larger is a mistake worth
 * refusing rather than quietly storing in a document read on every request.
 */
const LOGO_MAX_BYTES = 512 * 1024

const logo = z
  .string()
  .trim()
  .regex(/^data:image\/(png|jpeg|svg\+xml|webp);base64,[A-Za-z0-9+/=]+$/, 'Upload a PNG, JPEG, SVG or WebP image.')
  .refine((v) => v.length <= LOGO_MAX_BYTES, `Keep the logo under ${Math.round(LOGO_MAX_BYTES / 1024)} KB.`)
  .nullable()

const brandingSchema = z.object({
  primaryColor: hex.optional(),
  secondaryColor: hex.optional(),
  accentColor: hex.optional(),
  logoUrl: logo.optional(),
  logoText: z.string().trim().max(40).optional(),
  faviconUrl: logo.optional(),
})

const invoiceSchema = z.object({
  legalName: z.string().trim().max(160).optional(),
  legalNameAr: z.string().trim().max(160).optional(),
  crNumber: z.string().trim().max(40).optional(),
  vatNumber: z.string().trim().max(40).optional(),
  address: z.string().trim().max(240).optional(),
  addressAr: z.string().trim().max(240).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(120).optional(),
  vatRate: z.coerce.number().min(0).max(1).optional(),
})

const createSchema = z.object({
  slug: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(80),
  nameAr: z.string().trim().max(80).optional(),
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().max(64).optional(),
  locale: z.enum(['en', 'ar']).optional(),
  secondaryLocale: z.enum(['en', 'ar']).optional(),
  invoice: invoiceSchema.optional(),
  branding: brandingSchema.optional(),
  capabilities: z.array(z.string().trim()).optional(),
  enabledProfiles: z.array(z.string().trim()).optional(),
  admin: z.object({
    email: z.string().email(),
    fullName: z.string().trim().min(2).max(80),
    password: z.string().min(8, 'A first administrator needs a password of at least 8 characters.'),
  }),
})

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  nameAr: z.string().trim().max(80).optional(),
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().max(64).optional(),
  locale: z.enum(['en', 'ar']).optional(),
  secondaryLocale: z.enum(['en', 'ar']).optional(),
  invoice: invoiceSchema.optional(),
  branding: brandingSchema.optional(),
  capabilities: z.array(z.string().trim()).optional(),
  enabledProfiles: z.array(z.string().trim()).optional(),
})

/** What a control-plane screen is allowed to know about a tenant: everything except its data. */
function summarise(t: TenantRegistryDoc) {
  const steps = t.provisioning?.steps ?? []
  const done = steps.filter((s) => s.status === 'DONE').length
  return {
    id: t._id,
    slug: t.slug,
    name: t.name,
    nameAr: (t as TenantRegistryDoc & { nameAr?: string }).nameAr ?? '',
    dbName: t.dbName,
    lifecycle: t.lifecycle,
    isSynthetic: t.isSynthetic ?? false,
    branding: t.branding,
    invoice: t.invoice,
    currency: t.currency,
    timezone: t.timezone,
    locale: t.locale,
    secondaryLocale: t.secondaryLocale,
    capabilities: t.capabilities ?? [],
    enabledProfiles: t.enabledProfiles ?? [],
    provisioning: {
      steps,
      done,
      total: steps.length,
      lastError: t.provisioning?.lastError ?? null,
      startedAt: t.provisioning?.startedAt ?? null,
      completedAt: t.provisioning?.completedAt ?? null,
    },
    suspendedReason: t.suspendedReason ?? null,
    // Where this tenant's own people sign in. The control plane never signs in for them.
    loginPath: `/t/${t.slug}/login`,
    createdAt: t.createdAt,
  }
}

/**
 * What a tenant's own login page may know about it, before anybody has signed in.
 *
 * Read with no credential at all, because a login page has none — so it carries only what is
 * already public the moment somebody visits that address: the company's name and the colours
 * on its front door. No invoice identity, no capabilities, no provisioning state, nothing
 * about any other tenant, and nothing that helps somebody enumerate who is on the platform:
 * an unknown handle is simply not found.
 */
export const publicTenantController = {
  /**
   * The workspaces somebody arriving at the platform's own front door may choose between.
   *
   * The generic sign-in page cannot be one tenant's — that was the bug: `/login` wore WAYZ's
   * name and listed WAYZ's staff, which made the root of a multi-tenant product implicitly
   * mean whichever tenant happened to be built first. It needs something neutral to offer
   * instead, and this is it.
   *
   * Gated behind DEMO_LOGINS, and deliberately so. Being able to ask a server for the list of
   * every company using it is exactly the enumeration `bySlug` already refuses to allow — an
   * unknown handle there is simply *not found*, on purpose. A demonstration wants a list to
   * click; a real deployment returns an empty one and its front door asks for the handle,
   * which the people who work there already know.
   */
  directory: asyncHandler(async (_req, res) => {
    if (!env.DEMO_LOGINS) {
      res.json({ success: true, data: [] })
      return
    }

    const { TenantRegistry } = platformDb()
    const rows = await TenantRegistry.find({ lifecycle: { $ne: 'SUSPENDED' } })
      .sort({ name: 1 })
      .lean<TenantRegistryDoc[]>()

    res.json({
      success: true,
      data: rows
        // A tenant conjured by a test run is not a company anybody should be offered.
        .filter((r) => !r.isSynthetic)
        .map((r) => ({
          slug: r.slug,
          name: r.name,
          nameAr: (r as TenantRegistryDoc & { nameAr?: string }).nameAr ?? '',
          branding: r.branding,
        })),
    })
  }),

  bySlug: asyncHandler(async (req, res) => {
    const { TenantRegistry } = platformDb()
    const row = await TenantRegistry.findOne({ slug: String(req.params.slug).toLowerCase() }).lean<TenantRegistryDoc>()
    if (!row || row.lifecycle === 'SUSPENDED') throw ApiError.notFound('No such workspace.')

    /*
     * The demo accounts this tenant seeded, on a deployment that admits to being a demo.
     *
     * Every tenant seeds its own, so the list has to come from that tenant's database rather
     * than from a constant in the web app — which is what made the old login page show WAYZ's
     * roles to everybody. Off unless DEMO_LOGINS says otherwise, because publishing a list of
     * working accounts is exactly what a real deployment must never do.
     */
    const demoLogins = env.DEMO_LOGINS
      ? await runInTenant(row._id, async () => {
          const [staff, kiosks, roleDefs] = await Promise.all([
            /*
             * `demoCredential` and `passwordHash` are both `select: false`, so they have to be
             * asked for by name. They go no further than seededDemoLoginsFor, which uses the
             * hash only to prove the credential works and never returns it.
             */
            User.find(
              { active: true },
              { email: 1, fullName: 1, role: 1, roleKey: 1, kioskId: 1, engineKinds: 1, demoCredential: 1, passwordHash: 1 },
            ).lean(),
            Kiosk.find({}, { name: 1 }).lean(),
            /* What this company calls each of its jobs. */
            RoleDefinition.find({}, { key: 1, label: 1 }).lean(),
          ])
          const deskName = new Map(kiosks.map((k) => [k._id, k.name]))
          const jobTitle = new Map(roleDefs.map((r) => [r.key, r.label]))
          return seededDemoLoginsFor(
            staff.map((u) => ({
              email: u.email,
              fullName: u.fullName,
              role: u.role,
              kioskName: u.kioskId ? (deskName.get(u.kioskId) ?? null) : null,
              engineKinds: u.engineKinds ?? [],
              roleLabel: u.roleKey ? (jobTitle.get(u.roleKey) ?? null) : null,
              demoCredential: u.demoCredential ?? null,
              passwordHash: u.passwordHash ?? null,
            })),
          )
        })
      : []

    res.json({
      success: true,
      data: {
        slug: row.slug,
        name: row.name,
        nameAr: (row as TenantRegistryDoc & { nameAr?: string }).nameAr ?? '',
        branding: row.branding,
        locale: row.locale,
        secondaryLocale: row.secondaryLocale,
        demoLogins,
      },
    })
  }),
}

export const platformController = {
  signIn: asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body)
    res.json({ success: true, data: await platformSignIn(body.email, body.password) })
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ success: true, data: platformActor(req) })
  }),

  /** What a tenant can be given: the vocabulary the creation form offers, from one place. */
  vocabulary: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { capabilities: CAPABILITIES, profiles: PLATFORM_PROFILES } })
  }),

  tenants: asyncHandler(async (req, res) => {
    const { TenantRegistry } = platformDb()

    /*
     * Real customers by default; the test harness's own tenants only when asked for.
     *
     * The isolation suite has to create a genuine tenant to prove isolation is genuine, and
     * what it leaves behind then sat in this list looking like a paying company. Hidden rather
     * than deleted, because a run that fails half way leaves its tenant behind exactly when
     * somebody needs to look at it — so `?includeSynthetic=true` still shows them.
     */
    const includeSynthetic = String(req.query.includeSynthetic ?? '') === 'true'
    const where = includeSynthetic ? {} : { isSynthetic: { $ne: true } }

    const rows = await TenantRegistry.find(where).sort({ createdAt: -1 }).lean<TenantRegistryDoc[]>()
    res.json({ success: true, data: rows.map(summarise) })
  }),

  tenant: asyncHandler(async (req, res) => {
    const { TenantRegistry } = platformDb()
    const row = await TenantRegistry.findById(req.params.id).lean<TenantRegistryDoc>()
    if (!row) throw ApiError.notFound('No such tenant.')
    res.json({ success: true, data: summarise(row) })
  }),

  /**
   * Creates a tenant and provisions it in one request.
   *
   * One call because the two halves are meaningless apart: a registry row with no database
   * behind it is a tenant nobody can sign in to, and it is far too easy to leave one lying
   * around if creating and provisioning are separate buttons. Provisioning is idempotent and
   * records every step, so a failure half way leaves a row that says exactly where it stopped and
   * can be retried rather than a mess to clean up by hand.
   */
  create: asyncHandler(async (req, res) => {
    const actor = platformActor(req)
    const body = createSchema.parse(req.body)
    assertUsableSlug(body.slug)

    const created = await createTenant({ ...body, createdBy: actor.id })
    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'TENANT_CREATED',
      tenantId: created._id,
      detail: `${created.name} (${created.slug}) → ${created.dbName}`,
    })

    let provisioned: TenantRegistryDoc
    try {
      provisioned = await provisionTenant(created._id, body.admin)
    } catch (err) {
      // The row survives with its failed step recorded, which is what Retry acts on.
      const { TenantRegistry } = platformDb()
      const partial = await TenantRegistry.findById(created._id).lean<TenantRegistryDoc>()
      res.status(202).json({
        success: false,
        message: err instanceof Error ? err.message : 'Provisioning did not finish.',
        data: partial ? summarise(partial) : null,
      })
      return
    }

    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'TENANT_PROVISIONED',
      tenantId: created._id,
      detail: `First administrator ${body.admin.email}`,
    })
    res.status(201).json({ success: true, data: summarise(provisioned) })
  }),

  /** Picks a half-finished provisioning back up from the step that failed. */
  retryProvisioning: asyncHandler(async (req, res) => {
    const actor = platformActor(req)
    const body = z
      .object({
        admin: z
          .object({
            email: z.string().email(),
            fullName: z.string().trim().min(2),
            password: z.string().min(8),
          })
          .optional(),
      })
      .parse(req.body ?? {})

    const { TenantRegistry } = platformDb()
    const row = await TenantRegistry.findById(req.params.id).lean<TenantRegistryDoc>()
    if (!row) throw ApiError.notFound('No such tenant.')

    const admin = body.admin ?? {
      email: `admin@${row.slug}.invalid`,
      fullName: `${row.name} administrator`,
      password: '',
    }
    if (!body.admin) {
      /*
       * Retrying without naming an administrator only works if that step already succeeded.
       * Inventing a placeholder account would be worse than refusing: it would create a
       * credential nobody asked for, on a tenant somebody is about to start using.
       */
      const adminStep = (row.provisioning?.steps ?? []).find((s) => s.step === 'ADMIN_USER')
      if (adminStep && adminStep.status !== 'DONE') {
        throw ApiError.badRequest('This tenant still has no administrator — give one to retry with.')
      }
    }

    const done = await provisionTenant(row._id, admin)
    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'TENANT_PROVISION_RETRIED',
      tenantId: row._id,
      detail: `Resumed provisioning for ${row.name}`,
    })
    res.json({ success: true, data: summarise(done) })
  }),

  update: asyncHandler(async (req, res) => {
    const actor = platformActor(req)
    const body = patchSchema.parse(req.body)
    const { TenantRegistry } = platformDb()

    const row = await TenantRegistry.findById(req.params.id)
    if (!row) throw ApiError.notFound('No such tenant.')

    if (body.name !== undefined) row.name = body.name
    if (body.nameAr !== undefined) (row as unknown as { nameAr: string }).nameAr = body.nameAr
    if (body.currency !== undefined) row.currency = body.currency.toUpperCase()
    if (body.timezone !== undefined) row.timezone = body.timezone
    if (body.locale !== undefined) row.locale = body.locale
    if (body.secondaryLocale !== undefined) row.secondaryLocale = body.secondaryLocale
    if (body.capabilities) row.capabilities = [...new Set(body.capabilities)]
    if (body.enabledProfiles) row.enabledProfiles = [...new Set(body.enabledProfiles)]
    if (body.branding) row.branding = { ...row.branding, ...body.branding }
    if (body.invoice) row.invoice = { ...row.invoice, ...body.invoice }

    await row.save()

    /*
     * The registry is cached for a few seconds on every node that has served this tenant, so
     * a change made here has to evict it — otherwise an admin saves a new colour, reloads,
     * and sees the old one for long enough to believe the save failed.
     */
    forgetTenant(row._id)

    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'TENANT_UPDATED',
      tenantId: row._id,
      detail: Object.keys(body).join(', '),
    })
    res.json({ success: true, data: summarise(row.toObject() as TenantRegistryDoc) })
  }),

  /**
   * Suspends or reinstates a tenant.
   *
   * Suspension is a refusal at the connection, not a flag a screen is trusted to respect:
   * a suspended tenant cannot resolve a database at all, so every route for every one of
   * its users stops at once, including any session already signed in.
   */
  lifecycle: asyncHandler(async (req, res) => {
    const actor = platformActor(req)
    const body = z
      .object({
        lifecycle: z.enum(['ACTIVE', 'SUSPENDED']),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(req.body)

    const { TenantRegistry } = platformDb()
    const row = await TenantRegistry.findById(req.params.id)
    if (!row) throw ApiError.notFound('No such tenant.')

    if (body.lifecycle === 'SUSPENDED' && !body.reason?.trim()) {
      throw ApiError.badRequest('Say why this tenant is being suspended — their staff will be locked out at once.')
    }

    row.lifecycle = body.lifecycle
    row.suspendedReason = body.lifecycle === 'SUSPENDED' ? (body.reason ?? '') : null
    await row.save()
    forgetTenant(row._id)

    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: body.lifecycle === 'SUSPENDED' ? 'TENANT_SUSPENDED' : 'TENANT_REINSTATED',
      tenantId: row._id,
      detail: body.reason ?? '',
    })
    res.json({ success: true, data: summarise(row.toObject() as TenantRegistryDoc) })
  }),

  /**
   * Removes a tenant and drops its database.
   *
   * This is the one destructive thing the control plane can do, and it is guarded like it:
   *
   * The tenant must already be suspended, so removal is never the first action taken on a
   * live company — somebody has to stop it and then, separately, decide it should go. The
   * caller must type the handle back, because a confirmation dialog is dismissed by reflex
   * and a name is not. And it is recorded in the platform audit with the database that went,
   * so the deletion itself survives the thing deleted.
   *
   * It exists because the alternative is worse: a tenant created by mistake, with a permanent
   * handle, that can never be tidied away and clutters the list forever.
   */
  remove: asyncHandler(async (req, res) => {
    const actor = platformActor(req)
    const body = z.object({ confirm: z.string().trim() }).parse(req.body)

    const { TenantRegistry } = platformDb()
    const row = await TenantRegistry.findById(req.params.id).lean<TenantRegistryDoc>()
    if (!row) throw ApiError.notFound('No such tenant.')

    if (row.lifecycle !== 'SUSPENDED') {
      throw ApiError.unprocessable(`Suspend ${row.name} before removing it.`, [
        'Removing a live tenant would cut off staff who are working right now.',
      ])
    }
    if (body.confirm !== row.slug) {
      throw ApiError.badRequest(`Type "${row.slug}" to confirm — this drops ${row.dbName} and everything in it.`)
    }

    await dropTenantDatabase(row.dbName)
    await TenantRegistry.deleteOne({ _id: row._id })
    forgetTenant(row._id)

    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'TENANT_REMOVED',
      tenantId: row._id,
      detail: `${row.name} (${row.slug}) · dropped ${row.dbName}`,
    })
    res.json({ success: true, data: { removed: row._id, dbName: row.dbName } })
  }),

  /** The control plane's own trail: who created, suspended or reconfigured which tenant. */
  /**
   * The audit log, searchable the way somebody investigating actually searches.
   *
   * Free text matches the actor, the action, the tenant and the human description together,
   * because a person looking into an incident knows one of those and not which one. Sorted by
   * `at`, which is the field the entries are written with — the previous version sorted by
   * `createdAt`, which these documents do not have, so the "most recent 200" were in no
   * particular order.
   */
  audit: asyncHandler(async (req, res) => {
    const { PlatformAudit } = platformDb()

    const q: Record<string, unknown> = {}
    if (typeof req.query.tenantId === 'string' && req.query.tenantId) q.tenantId = req.query.tenantId
    if (typeof req.query.action === 'string' && req.query.action) q.action = req.query.action
    if (typeof req.query.actorId === 'string' && req.query.actorId) q.actorId = req.query.actorId

    if (typeof req.query.since === 'string' && req.query.since) {
      const since = new Date(req.query.since)
      if (!Number.isNaN(since.valueOf())) q.at = { $gte: since }
    }

    const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (search) {
      // Escaped: a search box must not be able to write a regular expression.
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(safe, 'i')
      q.$or = [{ actorEmail: rx }, { action: rx }, { tenantId: rx }, { detail: rx }]
    }

    const limit = Math.min(Number(req.query.limit) || 200, 500)
    const [rows, total, actions] = await Promise.all([
      PlatformAudit.find(q).sort({ at: -1 }).limit(limit).lean(),
      PlatformAudit.countDocuments(q),
      PlatformAudit.distinct('action'),
    ])

    res.json({ success: true, data: { rows, total, actions: (actions as string[]).sort() } })
  }),

  /**
   * A tenant's estate and its administrators, read live from that tenant's own database.
   *
   * The isolation rule is about *operational* records — bookings, payments, customers. Those
   * are never read here and never copied anywhere. What this returns is structural: where the
   * company operates and who administers it, which is exactly what a platform operator is
   * looking at this screen to find out.
   *
   * Read through the tenant's own connection at the moment of the request. Nothing is
   * duplicated into the control plane, so there is no second copy to drift.
   */
  structure: asyncHandler(async (req, res) => {
    const { TenantRegistry } = platformDb()
    const row = await TenantRegistry.findById(req.params.id).lean<TenantRegistryDoc>()
    if (!row) throw ApiError.notFound('No such tenant.')

    const data = await runInTenant(row._id, async (ctx) => {
      const { Site, Station, Kiosk, Gate, User } = ctx.models

      const [sites, stations, kiosks, gates, admins, staffCount] = await Promise.all([
        Site.find({}, { name: 1, city: 1 }).sort({ name: 1 }).lean(),
        Station.find({}, { name: 1, siteId: 1 }).sort({ name: 1 }).lean(),
        Kiosk.find({}, { name: 1, stationId: 1, engineKind: 1 }).sort({ name: 1 }).lean(),
        Gate.find({}, { name: 1, stationId: 1, code: 1 }).sort({ name: 1 }).lean(),
        User.find({ role: 'TENANT_ADMIN' }, { email: 1, fullName: 1, active: 1, createdAt: 1, lastLoginAt: 1 })
          .sort({ createdAt: 1 })
          .lean(),
        User.countDocuments({}),
      ])

      return { sites, stations, kiosks, gates, admins, staffCount }
    })

    res.json({ success: true, data })
  }),

  /** Real counts of real things. See `operations.service.ts` for why nothing here is estimated. */
  overview: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await platformOverview() })
  }),

  /** A live check of the API, the control plane and every tenant database. Names no secrets. */
  health: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await healthReport() })
  }),

  /** Platform-level analytics only — no tenant operational data is read or aggregated. */
  reports: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await platformReports() })
  }),

  /**
   * Who can administer the platform.
   *
   * Listed without anything that could be used to become one of them: no hashes, no tokens.
   */
  admins: asyncHandler(async (_req, res) => {
    const { PlatformAdmin } = platformDb()
    const rows = await PlatformAdmin.find({}, { passwordHash: 0 }).sort({ createdAt: 1 }).lean()
    res.json({ success: true, data: rows })
  }),

  /**
   * Creates another platform administrator.
   *
   * Behind `authenticatePlatform`, so only somebody who already holds the control plane can
   * widen it. There is no public route to this and there must never be one: a platform
   * administrator can reach every tenant on the installation, and self-service registration
   * for that is not a feature, it is a way in.
   */
  createAdmin: asyncHandler(async (req, res) => {
    const actor = platformActor(req)
    const body = z
      .object({
        email: z.string().email(),
        fullName: z.string().trim().min(2),
        password: z.string().min(12, 'A platform administrator’s password must be at least 12 characters.'),
      })
      .parse(req.body)

    const { PlatformAdmin } = platformDb()
    const email = body.email.toLowerCase()
    const clash = await PlatformAdmin.findOne({ email }).lean()
    if (clash) throw ApiError.conflict('Somebody already administers the platform with that address.')

    const created = await PlatformAdmin.create({
      _id: `padm_${randomUUID()}`,
      email,
      fullName: body.fullName.trim(),
      passwordHash: await hashPassword(body.password),
      active: true,
      lastLoginAt: null,
    })

    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'PLATFORM_ADMIN_CREATED',
      tenantId: null,
      detail: `Added platform administrator ${email}`,
    })

    const { passwordHash: _omit, ...safe } = created.toObject()
    res.status(201).json({ success: true, data: safe })
  }),

  /**
   * Suspends or restores a platform administrator.
   *
   * The last active one cannot be suspended: an installation with nobody able to sign in to
   * its control plane can only be recovered from the server's environment, and locking
   * yourself out with two clicks is not a state a product should allow.
   */
  setAdminActive: asyncHandler(async (req, res) => {
    const actor = platformActor(req)
    const { active } = z.object({ active: z.boolean() }).parse(req.body)

    const { PlatformAdmin } = platformDb()
    const row = await PlatformAdmin.findById(req.params.id)
    if (!row) throw ApiError.notFound('No such platform administrator.')

    if (!active) {
      if (row._id === actor.id) throw ApiError.badRequest('You cannot suspend your own access.')
      const remaining = await PlatformAdmin.countDocuments({ active: true, _id: { $ne: row._id } })
      if (remaining === 0) {
        throw ApiError.badRequest('This is the last active platform administrator.', [
          'Add another before suspending this one, or nobody will be able to sign in to the control plane.',
        ])
      }
    }

    row.active = active
    await row.save()

    await recordPlatformAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: active ? 'PLATFORM_ADMIN_RESTORED' : 'PLATFORM_ADMIN_SUSPENDED',
      tenantId: null,
      detail: `${active ? 'Restored' : 'Suspended'} platform administrator ${row.email}`,
    })

    const { passwordHash: _omit, ...safe } = row.toObject()
    res.json({ success: true, data: safe })
  }),
}
