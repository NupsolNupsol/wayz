import { Customer } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'

export const PHONE_PROOF_TTL_MIN = 30

const sameNumber = (phone: string) => phone.replace(/[^0-9]/g, '').slice(-9)

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, (m) => `\\${m}`)

export function listCustomers(tenantId: string, query?: string) {
  const q: Record<string, unknown> = { tenantId, active: { $ne: false } }
  if (query?.trim()) {
    const rx = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    q.$or = [{ name: rx }, { phone: rx }]
  }
  return Customer.find(q).sort({ createdAt: -1 }).limit(100).lean()
}

export async function getCustomer(tenantId: string, id: string) {
  const c = await Customer.findOne({ _id: id, tenantId }).lean()
  if (!c) throw ApiError.notFound('Customer not found.')
  return c
}

export async function createCustomer(tenantId: string, data: { name: string; phone: string; email?: string }) {
  return Customer.create({
    _id: await nextId('customer'),
    tenantId,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || undefined,
  })
}

/**
 * Records that a customer answered a code. The destination is whatever the desk sent it to — the
 * phone or the email on the booking — because a code read back over email proves the same thing,
 * and a proof that is not written here means the payment is refused with the customer standing there.
 */
export async function rememberPhoneVerified(tenantId: string, destination: string) {
  const value = destination.trim()
  if (!value) return
  const tail = sameNumber(value)
  const match: Record<string, unknown>[] = []
  if (tail) match.push({ phone: new RegExp(`${tail}$`) })
  if (value.includes('@')) match.push({ email: new RegExp(`^${escapeForRegex(value)}$`, 'i') })
  if (!match.length) return

  await Customer.updateMany({ tenantId, $or: match }, { $set: { phoneVerifiedAt: new Date() } })
}

export async function phoneProofIsFresh(tenantId: string, phone: string, now = new Date()) {
  const tail = sameNumber(phone)
  if (!tail) return false
  const customer = await Customer.findOne(
    { tenantId, phone: new RegExp(`${tail}$`), phoneVerifiedAt: { $ne: null } },
    { phoneVerifiedAt: 1 },
  )
    .sort({ phoneVerifiedAt: -1 })
    .lean()
  if (!customer?.phoneVerifiedAt) return false
  return now.getTime() - new Date(customer.phoneVerifiedAt).getTime() <= PHONE_PROOF_TTL_MIN * 60_000
}

export async function deactivateCustomer(tenantId: string, id: string) {
  const gone = await Customer.updateOne({ _id: id, tenantId }, { $set: { active: false } })
  if (gone.matchedCount === 0) throw ApiError.notFound('Customer not found.')
  return { removed: id }
}
