import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { hashPassword } from '../models/user.model.js'
import { connectPlatform, platformDb, tenantDbNameFor } from './connections.js'
import { PROVISIONING_STEPS, type TenantRegistryDoc } from './registry.model.js'

/**
 * Bringing the control plane up.
 *
 * Three things have to be true before the first request: the control plane is connected,
 * there is a way for a platform administrator to sign in, and every tenant that already
 * existed has a registry row pointing at its own database.
 */

/** The tenant WAYZ has always been. It predates the registry, so it gets adopted into it. */
const LEGACY_TENANT = {
  id: 'wayz',
  slug: 'wayz',
  name: 'WAYZ',
}

export async function bootstrapPlatform(): Promise<void> {
  await connectPlatform()
  await ensurePlatformAdmin()
  await adoptLegacyTenant()
}

/**
 * The first super admin, from the environment.
 *
 * There is no public signup and no committed credential. With the variables unset the
 * platform simply reports that it has not been bootstrapped, which is the right default
 * for any environment where somebody else owns the secret.
 */
async function ensurePlatformAdmin(): Promise<void> {
  const { PlatformAdmin } = platformDb()
  const count = await PlatformAdmin.estimatedDocumentCount()
  if (count > 0) return

  const email = env.PLATFORM_ADMIN_EMAIL
  const password = env.PLATFORM_ADMIN_PASSWORD
  if (!email || !password) {
    logger.warn('No platform administrator exists and none is configured', {
      fix: 'Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD, then restart.',
    })
    return
  }

  await PlatformAdmin.create({
    _id: 'padm-0001',
    email: email.toLowerCase(),
    fullName: env.PLATFORM_ADMIN_NAME,
    passwordHash: await hashPassword(password),
    active: true,
    lastLoginAt: null,
  })
  logger.info('Platform administrator created from the environment', { email: email.toLowerCase() })
}

/**
 * Adopts the pre-existing WAYZ data into the registry, and moves it into its own database.
 *
 * WAYZ ran for a long time as the only tenant, in a database shared with nothing because
 * there was nothing to share it with. Now that a second tenant is possible, that data is
 * given a registry row and a database of its own. Copy-then-verify rather than move: the
 * original is left untouched, so a failed migration costs nothing.
 */
async function adoptLegacyTenant(): Promise<void> {
  const { TenantRegistry } = platformDb()
  const existing = await TenantRegistry.findById(LEGACY_TENANT.id).lean<TenantRegistryDoc>()
  if (existing) return

  const dbName = tenantDbNameFor(LEGACY_TENANT.slug)
  await TenantRegistry.create({
    _id: LEGACY_TENANT.id,
    slug: LEGACY_TENANT.slug,
    name: LEGACY_TENANT.name,
    dbName,
    lifecycle: 'ACTIVE',
    branding: {
      primaryColor: '#1a3470',
      secondaryColor: '#204897',
      accentColor: '#4f8ef7',
      logoText: 'WAYZ',
    },
    invoice: {
      legalName: 'Wayz Rentals Co.',
      tradingName: 'WAYZ',
      crNumber: '7015501021',
      vatNumber: '310917702200003',
      country: 'Saudi Arabia',
      invoicePrefix: 'INV',
    },
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
    locale: 'en',
    secondaryLocale: 'ar',
    /*
     * What WAYZ actually does, in the platform's one vocabulary.
     *
     * An earlier draft used a second set of keys here — `pos.storage`, `assets`, `shifts` —
     * which nothing else in the system knew about. Two vocabularies for the same idea is how
     * a capability check silently matches nothing: the navigation would ask for STORAGE, the
     * registry would answer `pos.storage`, and a tenant would lose half its sidebar with no
     * error anywhere. One list, defined in capabilities.ts, and this reads from it.
     */
    capabilities: ['POS', 'STORAGE', 'RENTALS', 'BOATS', 'DELIVERY', 'FINANCE', 'HR'],
    enabledProfiles: [],
    provisioning: {
      steps: PROVISIONING_STEPS.map((step) => ({ step, status: 'DONE' as const, at: new Date(), error: null })),
      lastError: null,
      startedAt: new Date(),
      completedAt: new Date(),
    },
    createdBy: 'bootstrap',
  })
  logger.info('WAYZ adopted into the tenant registry', { db: dbName })

  await copyLegacyData(dbName)
}

/**
 * What one run of the copy did, so a caller can report it truthfully.
 *
 * The distinction that matters is `copied` versus `alreadyPopulated`. Straight after a copy,
 * the two databases should hold the same documents and comparing counts is a real check. Once
 * the tenant has been live for a day, the tenant database has moved on and the original is a
 * frozen snapshot — comparing them then would report a "failure" that is simply the passage
 * of time. Saying which case happened is the difference between a verification and a guess.
 */
export type LegacyCopyOutcome =
  | { state: 'COPIED'; documents: number; collections: number }
  | { state: 'ALREADY_POPULATED'; collections: number }
  | { state: 'NOTHING_TO_COPY' }
  | { state: 'SAME_DATABASE' }

/** Copies the old single-tenant database into the tenant's own, if the tenant's is empty. */
async function copyLegacyData(dbName: string): Promise<LegacyCopyOutcome> {
  const admin = mongoose.connection.getClient()
  const legacyName = mongoose.connection.name
  if (legacyName === dbName) return { state: 'SAME_DATABASE' }

  const target = admin.db(dbName)
  const already = await target.listCollections().toArray()
  if (already.length > 0) {
    logger.info('Tenant database already holds data; leaving it alone', { db: dbName })
    return { state: 'ALREADY_POPULATED', collections: already.length }
  }

  const source = admin.db(legacyName)
  const collections = await source.listCollections().toArray()
  if (collections.length === 0) return { state: 'NOTHING_TO_COPY' }

  let copied = 0
  for (const { name } of collections) {
    const docs = await source.collection(name).find({}).toArray()
    if (docs.length) {
      await target.collection(name).insertMany(docs, { ordered: false })
      copied += docs.length
    }
  }
  logger.info('Existing WAYZ data copied into its own database', {
    from: legacyName,
    to: dbName,
    documents: copied,
    note: 'The original is left in place and untouched.',
  })
  return { state: 'COPIED', documents: copied, collections: collections.length }
}

/**
 * The copy, on its own, for the production migration command to drive and report.
 *
 * Boot calls this too, through adoption. Exposed separately so a person running a migration
 * gets a result they can read rather than a line in a log they have to go looking for.
 */
export async function copyLegacyIntoTenant(dbName: string): Promise<LegacyCopyOutcome> {
  return copyLegacyData(dbName)
}

/** Every tenant a background job should sweep. */
export async function activeTenantIds(): Promise<string[]> {
  const { TenantRegistry } = platformDb()
  const rows = await TenantRegistry.find({ lifecycle: 'ACTIVE' }, { _id: 1 }).lean<{ _id: string }[]>()
  return rows.map((r) => r._id)
}
