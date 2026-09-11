import { logger } from '../config/logger.js'
import { hashPassword } from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { platformDb, tenantConnection, tenantDbNameFor } from './connections.js'
import { reindexTenantLogins } from './loginDirectory.js'
import { PROVISIONING_STEPS, type ProvisioningStep, type TenantRegistryDoc } from './registry.model.js'
import { modelsFor } from './tenantModels.js'
import { forgetTenant, runInTenantContext, type TenantContext } from './tenantContext.js'

/**
 * Bringing a tenant into existence.
 *
 * Provisioning is a sequence of steps, each recorded as it completes, because the useful
 * question after a failure is not "did it work" but "how far did it get". A retry resumes
 * from the first step that has not finished rather than starting again on a half-built
 * tenant — so a network blip during step four does not require deleting and recreating
 * everything before it.
 *
 * Every step is written to be safe to run twice.
 */

export interface NewTenantInput {
  slug: string
  name: string
  invoice?: Partial<TenantRegistryDoc['invoice']>
  branding?: Partial<TenantRegistryDoc['branding']>
  currency?: string
  timezone?: string
  locale?: string
  secondaryLocale?: string
  capabilities?: string[]
  enabledProfiles?: string[]
  admin: { email: string; fullName: string; password: string }
  createdBy: string
}

const SLUG = /^[a-z][a-z0-9-]{1,30}$/

export function assertUsableSlug(slug: string): string {
  const value = slug.trim().toLowerCase()
  if (!SLUG.test(value)) {
    throw ApiError.badRequest('A tenant handle is lowercase letters, digits and hyphens, starting with a letter.', [
      'It becomes part of the tenant’s web address and the name of its database, so it cannot be changed later.',
    ])
  }
  return value
}

export async function createTenant(input: NewTenantInput): Promise<TenantRegistryDoc> {
  const { TenantRegistry } = platformDb()
  const slug = assertUsableSlug(input.slug)

  const clash = await TenantRegistry.findOne({ slug }).lean<TenantRegistryDoc>()
  if (clash) throw ApiError.conflict(`A tenant already uses the handle "${slug}".`)

  const doc = await TenantRegistry.create({
    _id: slug,
    slug,
    name: input.name.trim(),
    dbName: tenantDbNameFor(slug),
    lifecycle: 'PROVISIONING',
    branding: input.branding ?? {},
    invoice: input.invoice ?? {},
    currency: input.currency ?? 'SAR',
    timezone: input.timezone ?? 'Asia/Riyadh',
    locale: input.locale ?? 'en',
    secondaryLocale: input.secondaryLocale ?? 'ar',
    capabilities: input.capabilities ?? [],
    enabledProfiles: input.enabledProfiles ?? [],
    provisioning: {
      steps: PROVISIONING_STEPS.map((step) => ({ step, status: 'PENDING' as const, at: null, error: null })),
      lastError: null,
      startedAt: new Date(),
      completedAt: null,
    },
    createdBy: input.createdBy,
  })

  return provisionTenant(doc._id, input.admin)
}

type StepRunner = (ctx: TenantContext, admin: NewTenantInput['admin']) => Promise<void>

const RUNNERS: Record<ProvisioningStep, StepRunner> = {
  /** Opening the connection is what creates the database. */
  DATABASE: async () => {},

  INDEXES: async (ctx) => {
    // Mongoose builds them lazily; doing it here means the first real request is not the
    // one that pays for it.
    await Promise.all(Object.values(ctx.models).map((model) => model.createIndexes().catch(() => undefined)))
  },

  PROFILES: async (ctx) => {
    const { Tenant } = ctx.models
    await Tenant.updateOne(
      { _id: ctx.tenantId },
      {
        $setOnInsert: {
          _id: ctx.tenantId,
          name: ctx.registry.name,
          legalName: ctx.registry.invoice?.legalName || ctx.registry.name,
          crNumber: ctx.registry.invoice?.crNumber || '',
          vatNumber: ctx.registry.invoice?.vatNumber || '',
          currency: ctx.registry.currency,
          enabledEngines: [],
        },
      },
      { upsert: true },
    )
  },

  ORG: async () => {
    // A tenant's sites, stations and kiosks are its own to describe; the platform does not
    // invent a venue for it. Left to the tenant admin, or to a template if one is chosen.
  },

  ADMIN_USER: async (ctx, admin) => {
    const { User } = ctx.models
    const existing = await User.findOne({ email: admin.email.toLowerCase() }).lean()
    if (existing) return

    await User.create({
      _id: `usr_admin_${ctx.slug}`,
      tenantId: ctx.tenantId,
      email: admin.email.toLowerCase(),
      fullName: admin.fullName,
      passwordHash: await hashPassword(admin.password),
      role: 'TENANT_ADMIN',
      engineKinds: [],
      stationId: '',
      kioskId: null,
      active: true,
    })
  },

  CATALOGUE: async () => {
    // Nothing to seed: what a tenant sells is configuration it owns, not something the
    // platform decides on its behalf.
  },
}

/** Runs provisioning from wherever it stopped. Safe to call repeatedly. */
export async function provisionTenant(
  tenantId: string,
  admin: NewTenantInput['admin'],
): Promise<TenantRegistryDoc> {
  const { TenantRegistry } = platformDb()
  const registry = await TenantRegistry.findById(tenantId).lean<TenantRegistryDoc>()
  if (!registry) throw ApiError.notFound('No such tenant.')

  const conn = await tenantConnection(registry.dbName)
  const ctx: TenantContext = {
    tenantId: registry._id,
    slug: registry.slug,
    dbName: registry.dbName,
    models: modelsFor(conn),
    registry,
  }

  for (const step of PROVISIONING_STEPS) {
    const done = registry.provisioning?.steps?.find((s) => s.step === step && s.status === 'DONE')
    if (done) continue

    try {
      await runInTenantContext(ctx, () => RUNNERS[step](ctx, admin))
      await TenantRegistry.updateOne(
        { _id: tenantId, 'provisioning.steps.step': step },
        { $set: { 'provisioning.steps.$.status': 'DONE', 'provisioning.steps.$.at': new Date(), 'provisioning.steps.$.error': null } },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await TenantRegistry.updateOne(
        { _id: tenantId, 'provisioning.steps.step': step },
        { $set: { 'provisioning.steps.$.status': 'FAILED', 'provisioning.steps.$.error': message } },
      )
      await TenantRegistry.updateOne({ _id: tenantId }, { $set: { lifecycle: 'FAILED', 'provisioning.lastError': message } })
      logger.error('Tenant provisioning failed', { tenant: tenantId, step, error: message })
      throw ApiError.unprocessable(`Provisioning stopped at ${step}.`, [message, 'Retrying resumes from this step.'])
    }
  }

  await TenantRegistry.updateOne(
    { _id: tenantId },
    { $set: { lifecycle: 'ACTIVE', 'provisioning.completedAt': new Date(), 'provisioning.lastError': null } },
  )

  // A tenant that just became ACTIVE must be usable now, not when the cache lapses.
  forgetTenant(tenantId)
  const finished = (await TenantRegistry.findById(tenantId).lean<TenantRegistryDoc>())!
  await reindexTenantLogins(finished)
  logger.info('Tenant provisioned', { tenant: tenantId, db: finished.dbName })
  return finished
}
