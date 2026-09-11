import { Schema, type Model } from 'mongoose'
import { platformDb, tenantConnection } from './connections.js'
import { modelsFor } from './tenantModels.js'
import { ApiError } from '../utils/ApiError.js'
import type { TenantRegistryDoc } from './registry.model.js'

/**
 * Which tenant a sign-in belongs to.
 *
 * Authentication is the one moment there is no token yet, so the tenant cannot come from
 * one. Two ways in, in this order:
 *
 *   1. The tenant says who it is — a per-tenant login page posts its own slug. This is
 *      the honest path and the one the UI uses.
 *   2. The email is looked up in this directory, for clients that only know an address.
 *
 * The directory holds an email and a tenant id and nothing else. It exists so that
 * resolving a login never means reading across tenant databases looking for a match.
 */

export interface LoginDirectoryDoc {
  _id: string
  email: string
  tenantId: string
}

export const loginDirectorySchema = new Schema<LoginDirectoryDoc>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tenantId: { type: String, required: true, index: true },
  },
  { _id: false, versionKey: false },
)

function directory(): Model<LoginDirectoryDoc> {
  const conn = platformDb().TenantRegistry.db
  return (
    (conn.models.LoginDirectory as Model<LoginDirectoryDoc>) ??
    conn.model<LoginDirectoryDoc>('LoginDirectory', loginDirectorySchema)
  )
}

export async function rememberLogin(email: string, tenantId: string): Promise<void> {
  const value = email.trim().toLowerCase()
  if (!value) return
  await directory().updateOne(
    { _id: value },
    { $set: { email: value, tenantId } },
    { upsert: true },
  )
}

export async function forgetLogin(email: string): Promise<void> {
  await directory().deleteOne({ _id: email.trim().toLowerCase() })
}

/**
 * Rebuilds the directory for one tenant from its own users.
 *
 * Run after seeding or provisioning, so a tenant is signable-into the moment it exists
 * without every user-creation path having to remember to register itself.
 */
export async function reindexTenantLogins(registry: TenantRegistryDoc): Promise<number> {
  const conn = await tenantConnection(registry.dbName)
  const { User } = modelsFor(conn)
  const users = await User.find({}, { email: 1 }).lean<{ email: string }[]>()

  const rows = users
    .map((u) => (u.email ?? '').trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({
      updateOne: { filter: { _id: email }, update: { $set: { email, tenantId: registry._id } }, upsert: true },
    }))

  if (!rows.length) return 0
  await directory().bulkWrite(rows, { ordered: false })
  return rows.length
}

export interface ResolvedLoginTenant {
  tenantId: string
  registry: TenantRegistryDoc
}

/** Finds the tenant a sign-in belongs to: an explicit slug first, then the directory. */
export async function tenantForLogin(email: string, slug?: string): Promise<ResolvedLoginTenant> {
  const { TenantRegistry } = platformDb()

  if (slug) {
    const bySlug = await TenantRegistry.findOne({ slug: slug.trim().toLowerCase() }).lean<TenantRegistryDoc>()
    if (!bySlug) throw ApiError.unauthorized('Unknown tenant.')
    return { tenantId: bySlug._id, registry: bySlug }
  }

  const hit = await directory().findById(email.trim().toLowerCase()).lean<LoginDirectoryDoc>()
  // Deliberately the same refusal as a wrong password: an unknown address should not be
  // distinguishable from a known one at an unknown tenant.
  if (!hit) throw ApiError.unauthorized('Invalid email or password.')

  const registry = await TenantRegistry.findById(hit.tenantId).lean<TenantRegistryDoc>()
  if (!registry) throw ApiError.unauthorized('Invalid email or password.')
  return { tenantId: registry._id, registry }
}
