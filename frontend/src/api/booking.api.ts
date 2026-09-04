import { http, unwrap } from './client'
import type {
  AvailableTransition,
  Booking,
  EngineKind,
  IdDocumentType,
  Order,
  OtpChannel,
  OtpDelivery,
  PaymentMethod,
  Receipt,
  VerificationPurpose,
} from './types'

export interface BagInput {
  category?: string
  description?: string
  dimensions?: { w: number; h: number; d: number }
  weight?: number
}
export interface CreateBookingInput {
  customerId: string
  engineKind: EngineKind
  productId: string
  quantity?: number
  durationMin?: number
  rateMode?: 'HOURS' | 'TOURS'
  tours?: number
  bags?: BagInput[]
  metadata?: Record<string, unknown>
}
export interface TransitionPayload {
  scannedUnitId?: string
  scannedBarcodes?: string[]
  unitId?: string
  reason?: string
  durationMin?: number
  inspectionDone?: boolean
  safetyAck?: boolean
  boardingVerified?: boolean
}

export interface VerificationDocumentInput {
  documentType: IdDocumentType
  documentNumber: string
  holderName: string
  image?: string
}

export type ConfirmVerificationInput =
  | { method: 'WHATSAPP_OTP'; purpose?: VerificationPurpose; code: string }
  | { method: 'EMAIL_OTP'; purpose?: VerificationPurpose; code: string }
  | { method: 'ID_DOCUMENT'; purpose?: VerificationPurpose; reason: string; document: VerificationDocumentInput }
  | {
      method: 'MANAGER_OVERRIDE'
      purpose?: VerificationPurpose
      reason: string
      authoriserEmail: string
      authoriserPassword: string
      document?: VerificationDocumentInput
    }

export interface VerificationChallenge {
  delivered: OtpDelivery
  channel: OtpChannel
  destinationMasked: string
  phoneMasked: string
  expiresInSec: number
  error?: string
}

export interface RefundPosition {
  paid: number
  refunded: number
  refundable: number
  methods?: string[]
  pending?: {
    ref: string
    amount: number
    reason: string
    requestedByName: string
    at: string
  } | null
  canApprove?: boolean
}

export interface RefundOutcome extends RefundPosition {
  approved: boolean
  request: { ref: string; amount: number } | null
  booking?: Booking
}

export const bookingApi = {
  list: (params?: { status?: string; engineKind?: EngineKind }) => unwrap<Booking[]>(http.get('/bookings', { params })),
  get: (id: string) => unwrap<Booking>(http.get(`/bookings/${id}`)),
  order: (id: string) => unwrap<Order>(http.get(`/bookings/${id}/order`)),
  transitions: (id: string) => unwrap<{ allowed: boolean; message: string; transitions: AvailableTransition[] }>(http.get(`/bookings/${id}/transitions`)),
  create: (input: CreateBookingInput) => unwrap<{ booking: Booking; order: Order }>(http.post('/bookings', input)),
  pay: (id: string, splits: { method: PaymentMethod; amount: number; kind?: string }[]) =>
    unwrap<{ booking: Booking; order: Order; receipt: Receipt }>(http.post(`/bookings/${id}/pay`, { splits })),
  reserve: (id: string, unitId?: string) => unwrap<Booking>(http.post(`/bookings/${id}/reserve`, unitId ? { unitId } : {})),
  reassign: (id: string, unitId: string, reason: string) => unwrap<Booking>(http.post(`/bookings/${id}/reassign`, { unitId, reason })),
  scanOut: (id: string, barcode: string) => unwrap<Booking>(http.post(`/bookings/${id}/scan-out`, { barcode })),
  settle: (id: string, splits: { method: PaymentMethod; cardScheme?: string | null; amount: number }[]) =>
    unwrap<{ booking: Booking; order: Order; collected: number; due: number }>(
      http.post(`/bookings/${id}/settle`, { splits }),
    ),
  returnHere: (id: string, code: string) =>
    unwrap<{ booking: Booking; wrongStation: boolean }>(http.post(`/bookings/${id}/return`, { code })),
  whatsappInvoice: (id: string, pdfBase64: string) =>
    unwrap<{ sent: boolean; asText: boolean; url: string; reason?: string }>(
      http.post(`/bookings/${id}/invoice/whatsapp`, { pdfBase64 }),
    ),
  refundPosition: (id: string) => unwrap<RefundPosition>(http.get(`/bookings/${id}/refund`)),
  refund: (id: string, input: { amount?: number; reason: string }) =>
    unwrap<RefundOutcome>(http.post(`/bookings/${id}/refund`, input)),
  transition: (id: string, code: string, payload?: TransitionPayload) => unwrap<Booking>(http.post(`/bookings/${id}/transition`, { code, payload })),

  sendVerification: (id: string, purpose: VerificationPurpose = 'RETRIEVAL', channel: OtpChannel = 'WHATSAPP') =>
    unwrap<VerificationChallenge>(http.post(`/bookings/${id}/verification/send`, { purpose, channel })),
  confirmVerification: (id: string, input: ConfirmVerificationInput, purpose: VerificationPurpose = 'RETRIEVAL') =>
    unwrap<Booking>(http.post(`/bookings/${id}/verification/confirm`, { purpose, ...input })),
  verificationEvidence: (id: string, evidenceId: string) =>
    unwrap<{ id: string; mimeType: string; dataUri: string; createdAt: string }>(
      http.get(`/bookings/${id}/verification/evidence/${evidenceId}`),
    ),
}
