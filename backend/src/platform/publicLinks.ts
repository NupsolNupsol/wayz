import { Schema, type Model } from 'mongoose'
import type { NextFunction, Request, Response } from 'express'
import { platformDb, tenantConnection } from './connections.js'
import { modelsFor } from './tenantModels.js'
import { enterTenant, type TenantContext } from './tenantContext.js'
import { ApiError } from '../utils/ApiError.js'
import type { TenantRegistryDoc } from './registry.model.js'

/**
 * Which tenant a public link belongs to.
 *
 * A customer opening a tracking link or an invoice PDF has no account and no token to
 * name a tenant with — and the link may have been sent over WhatsApp weeks ago. Changing
 * the shape of those URLs would break every one already in somebody's phone, so instead
 * the platform keeps a small directory: the opaque token that is already in the link,
 * mapped to the tenant that issued it.
 *
 * It holds a token and a tenant id. No customer data lives in the control plane.
 */

export interface PublicLinkDoc {
  _id: string
  tenantId: string
  issuedAt: Date
}

export const publicLinkSchema = new Schema<PublicLinkDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    issuedAt: { type: Date, default: () => new Date() },
  },
  { _id: false, versionKey: false },
)

function links(): Model<PublicLinkDoc> {
  const conn = platformDb().TenantRegistry.db
  return (conn.models.PublicLink as Model<PublicLinkDoc>) ?? conn.model<PublicLinkDoc>('PublicLink', publicLinkSchema)
}

export async function registerPublicToken(token: string, tenantId: string): Promise<void> {
  if (!token) return
  await links().updateOne({ _id: token }, { $set: { tenantId } }, { upsert: true })
}

/** Rebuilds a tenant's public links from its own bookings — used after seeding or migration. */
export async function reindexPublicLinks(registry: TenantRegistryDoc): Promise<number> {
  const conn = await tenantConnection(registry.dbName)
  const { Booking, InvoiceDoc } = modelsFor(conn)

  // Both kinds of link a customer can be sent: the tracking page and the invoice PDF.
  const [bookings, invoices] = await Promise.all([
    Booking.find({ trackingToken: { $nin: [null, ''] } }, { trackingToken: 1 }).lean<{ trackingToken: string }[]>(),
    InvoiceDoc.find({}, { _id: 1 }).lean<{ _id: string }[]>(),
  ])

  const tokens = [...bookings.map((b) => b.trackingToken), ...invoices.map((i) => i._id)].filter(Boolean)
  const writes = tokens.map((token) => ({
    updateOne: { filter: { _id: token }, update: { $set: { tenantId: registry._id } }, upsert: true },
  }))
  if (!writes.length) return 0
  await links().bulkWrite(writes, { ordered: false })
  return writes.length
}

async function contextForToken(token: string): Promise<TenantContext> {
  const hit = await links().findById(token).lean<PublicLinkDoc>()
  if (!hit) throw ApiError.notFound('That link has expired.')

  const { TenantRegistry } = platformDb()
  const registry = await TenantRegistry.findById(hit.tenantId).lean<TenantRegistryDoc>()
  if (!registry || registry.lifecycle !== 'ACTIVE') throw ApiError.notFound('That link has expired.')

  const conn = await tenantConnection(registry.dbName)
  return {
    tenantId: registry._id,
    slug: registry.slug,
    dbName: registry.dbName,
    models: modelsFor(conn),
    registry,
  }
}

/**
 * Enters the tenant that issued the link in this URL.
 *
 * A token nobody issued is "expired" rather than "unknown": a public endpoint should not
 * confirm whether a given token ever existed.
 *
 * `key` exists for links whose token is a bearer secret. An invitation is one: the tenant
 * stores only a hash of it, and so does this directory — the presented token is hashed
 * before it is looked up, so a copy of the control plane still does not hand anybody a
 * working invitation.
 */
export function withPublicLinkTenant(param: string, key: (raw: string) => string = (raw) => raw) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const raw = String(req.params[param] ?? '')
    if (!raw) return next(ApiError.notFound('That link has expired.'))
    contextForToken(key(raw))
      .then((ctx) => enterTenant(ctx, next))
      .catch(next)
  }
}
