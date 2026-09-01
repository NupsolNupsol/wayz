import { VerificationEvidence } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import type { IdentityVerification } from '../models/index.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { Role, VerificationPurpose } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { sendOtp, verifyOtp } from './otp.service.js'
import { isEmailConfigured, maskEmail } from './email.service.js'
import { isWhatsAppConfigured } from './whatsapp.service.js'
import { authenticateOverride } from './auth.service.js'
import { loadBooking } from './booking.service.js'
import type { ConfirmVerificationInput } from '../interfaces/index.js'
import type { OtpChannel, OtpDelivery, OtpIntent, Scope } from '../interfaces/index.js'

const VERIFICATION_TTL_MIN = 30

const OVERRIDE_ROLES: Role[] = ['MANAGER', 'TENANT_ADMIN']

const OTP_INTENT: Record<VerificationPurpose, OtpIntent> = {
  RETRIEVAL: 'HANDOVER_BAG',
  DEPOSIT_REFUND: 'HANDOVER_BAG',
  DELIVERY_REQUEST: 'HANDOVER_BAG',
}

const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024
const EVIDENCE_MIME = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '••••'
  return `${'•'.repeat(Math.max(2, digits.length - 4))}${digits.slice(-4)}`
}

function assertOpenForVerification(booking: BookingHydrated, purpose: VerificationPurpose) {
  if (['RETRIEVAL', 'DELIVERY_REQUEST'].includes(purpose) && !['ACTIVE', 'OVERTIME'].includes(booking.status)) {
    throw ApiError.badRequest(
      `${purpose === 'DELIVERY_REQUEST' ? 'Delivery' : 'Retrieval'} verification does not apply to a booking in status ${booking.status}.`,
    )
  }
}

function destinationFor(booking: BookingHydrated, channel: OtpChannel): string {
  const value = channel === 'EMAIL' ? booking.customerEmail : booking.customerPhone
  if (!value) {
    throw ApiError.unprocessable(
      channel === 'EMAIL'
        ? 'No email address was recorded for this customer — use WhatsApp or the ID document fallback.'
        : 'This booking has no customer phone — use email or the ID document fallback.',
    )
  }
  return value
}

const maskDestination = (channel: OtpChannel, value: string) => (channel === 'EMAIL' ? maskEmail(value) : maskPhone(value))

export function availableChannels(booking: BookingHydrated) {
  return [
    { channel: 'WHATSAPP' as const, configured: isWhatsAppConfigured(), hasDestination: !!booking.customerPhone },
    { channel: 'EMAIL' as const, configured: isEmailConfigured(), hasDestination: !!booking.customerEmail },
  ]
}

export async function sendVerificationChallenge(
  scope: Scope,
  bookingId: string,
  purpose: VerificationPurpose,
  channel: OtpChannel = 'WHATSAPP',
): Promise<{
  delivered: OtpDelivery
  channel: OtpChannel
  destinationMasked: string
  phoneMasked: string
  expiresInSec: number
  error?: string
}> {
  const booking = await loadBooking(scope, bookingId)
  assertOpenForVerification(booking, purpose)
  const destination = destinationFor(booking, channel)

  const res = await sendOtp(destination, OTP_INTENT[purpose], {
    channel,
    allowMockFallback: false,
    purpose: 'RETRIEVAL',
    customerName: booking.customerName,
  })
  const masked = maskDestination(channel, destination)

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: `VERIFICATION_CHALLENGE_${res.delivered}`,
    entity: 'Booking',
    entityId: booking._id,
    detail: `${purpose} via ${channel} → ${masked}`,
    reason: res.error,
  })

  return {
    delivered: res.delivered,
    channel,
    destinationMasked: masked,
    phoneMasked: masked,
    expiresInSec: 5 * 60,
    error: res.error,
  }
}

async function storeEvidence(
  scope: Scope,
  booking: BookingHydrated,
  purpose: VerificationPurpose,
  image: string,
): Promise<string> {
  const match = EVIDENCE_MIME.exec(image.trim())
  if (!match) throw ApiError.badRequest('The document image must be a JPEG, PNG or WebP data URI.')
  const [, mimeType, base64] = match
  const sizeBytes = Math.floor((base64.replace(/\s/g, '').length * 3) / 4)
  if (sizeBytes > MAX_EVIDENCE_BYTES) {
    throw ApiError.badRequest(`The document image is too large (max ${MAX_EVIDENCE_BYTES / 1024 / 1024} MB).`)
  }

  const doc = await VerificationEvidence.create({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    bookingId: booking._id,
    purpose,
    mimeType,
    sizeBytes,
    dataUri: image.trim(),
    capturedBy: scope.agentId,
  })
  return doc._id
}

function last4(documentNumber: string): string {
  const clean = documentNumber.replace(/\s/g, '')
  if (clean.length < 4) throw ApiError.badRequest('The document number is too short.')
  return clean.slice(-4)
}

export async function confirmVerification(
  scope: Scope,
  bookingId: string,
  input: ConfirmVerificationInput,
): Promise<BookingHydrated> {
  const booking = await loadBooking(scope, bookingId)
  assertOpenForVerification(booking, input.purpose)

  const now = new Date()
  const base = {
    purpose: input.purpose,
    status: 'VERIFIED' as const,
    verifiedAt: now,
    verifiedBy: scope.agentId,
    verifiedByRole: scope.role,
    expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MIN * 60_000),
    consumedAt: null,
  }

  let verification: IdentityVerification
  let auditReason: string | undefined

  switch (input.method) {
    case 'WHATSAPP_OTP':
    case 'EMAIL_OTP': {
      const channel: OtpChannel = input.method === 'EMAIL_OTP' ? 'EMAIL' : 'WHATSAPP'
      const destination = destinationFor(booking, channel)
      const ok = verifyOtp(destination, OTP_INTENT[input.purpose], input.code)
      if (!ok) throw ApiError.unprocessable('Incorrect or expired code — the customer is not verified.')
      verification = {
        ...base,
        method: input.method,
        channel,
        destination,
        phone: channel === 'WHATSAPP' ? destination : null,
        reason: null,
        document: null,
        evidenceId: null,
      }
      break
    }

    case 'ID_DOCUMENT': {
      if (!input.reason?.trim()) throw ApiError.unprocessable('State why the WhatsApp code could not be used.')
      const evidenceId = input.document.image ? await storeEvidence(scope, booking, input.purpose, input.document.image) : null
      verification = {
        ...base,
        method: 'ID_DOCUMENT',
        channel: null,
        phone: null,
        reason: input.reason.trim(),
        document: {
          type: input.document.documentType,
          holderName: input.document.holderName.trim(),
          last4: last4(input.document.documentNumber),
        },
        evidenceId,
      }
      auditReason = input.reason.trim()
      break
    }

    case 'MANAGER_OVERRIDE': {
      if (!input.reason?.trim()) throw ApiError.unprocessable('An override requires a reason.')
      const supervisor = await authenticateOverride(scope.tenantId, input.authoriserEmail, input.authoriserPassword, OVERRIDE_ROLES)
      const evidenceId = input.document?.image ? await storeEvidence(scope, booking, input.purpose, input.document.image) : null
      verification = {
        ...base,
        method: 'MANAGER_OVERRIDE',
        channel: null,
        phone: null,
        verifiedBy: supervisor._id,
        verifiedByRole: supervisor.role,
        reason: input.reason.trim(),
        document: input.document
          ? {
              type: input.document.documentType,
              holderName: input.document.holderName.trim(),
              last4: last4(input.document.documentNumber),
            }
          : null,
        evidenceId,
      }
      auditReason = `${input.reason.trim()} (authorised by ${supervisor.email})`
      break
    }
  }

  booking.verifications.push(verification)
  booking.markModified('verifications')
  await booking.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: `VERIFY_IDENTITY_${verification.method}`,
    entity: 'Booking',
    entityId: booking._id,
    reason: auditReason,
    detail: `${input.purpose} verified${verification.document ? ` · ${verification.document.type} ••${verification.document.last4}` : ''}`,
  })

  return booking
}

export async function getEvidence(scope: Scope, bookingId: string, evidenceId: string) {
  const evidence = await VerificationEvidence.findOne({
    _id: evidenceId,
    bookingId,
    tenantId: scope.tenantId,
    stationId: scope.stationId,
  }).lean()
  if (!evidence) throw ApiError.notFound('Evidence not found.')

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'VIEW_VERIFICATION_EVIDENCE',
    entity: 'Booking',
    entityId: bookingId,
    detail: evidenceId,
  })

  return { id: evidence._id, mimeType: evidence.mimeType, dataUri: evidence.dataUri, createdAt: evidence.createdAt }
}
