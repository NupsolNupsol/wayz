import { Customer } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'
import { logger } from '../config/logger.js'

export const PHONE_PROOF_TTL_MIN = 30

const sameNumber = (phone: string) => phone.replace(/[^0-9]/g, '').slice(-9)

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, (m) => `\\${m}`)

/**
 * Finds a number's last digits however the number happens to be punctuated.
 *
 * A phone reaches us written the way whoever typed it writes one: "+212 643 368 622",
 * "0643368622", "+966 55-123-4567". Matching the digits as a literal run at the end of the stored
 * text found the unspaced ones and quietly missed the rest — and a confirmation that matches
 * nobody is written to nobody, so the box went green and the payment was refused a moment later
 * with "Confirm <name> before taking their money". Separators are allowed between the digits here,
 * so the same number written two ways is still the same number.
 */
function endsWithDigits(tail: string): RegExp | null {
  if (!tail) return null
  return new RegExp(`${tail.split('').join('\\D*')}\\D*$`)
}

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

export async function createCustomer(
  tenantId: string,
  data: { name: string; phone: string; email?: string; nationalId: string },
) {
  return Customer.create({
    _id: await nextId('customer'),
    tenantId,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || undefined,
    nationalId: data.nationalId.trim(),
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
  const byNumber = endsWithDigits(sameNumber(value))
  const match: Record<string, unknown>[] = []
  if (byNumber) match.push({ phone: byNumber })
  if (value.includes('@')) match.push({ email: new RegExp(`^${escapeForRegex(value)}$`, 'i') })
  if (!match.length) return

  const written = await Customer.updateMany({ tenantId, $or: match }, { $set: { phoneVerifiedAt: new Date() } })

  // Silence here used to be the whole bug: nothing matched, nothing was written, and the refusal
  // came later at the till. If it happens again it is worth reading in the log, not guessing at.
  if (written.matchedCount === 0) {
    logger.warn('confirmation matched no customer, so no proof was recorded', { tenantId, destination: value })
  }
}

export async function phoneProofIsFresh(tenantId: string, phone: string, now = new Date()) {
  const byNumber = endsWithDigits(sameNumber(phone))
  if (!byNumber) return false
  const customer = await Customer.findOne(
    { tenantId, phone: byNumber, phoneVerifiedAt: { $ne: null } },
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
