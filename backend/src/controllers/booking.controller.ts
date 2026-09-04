import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { scopeFromReq } from '../utils/scope.js'
import { ENGINE_KINDS, ID_DOCUMENT_TYPES, VERIFICATION_PURPOSES } from '../domain/types.js'
import {
  confirmVerification,
  getEvidence,
  sendVerificationChallenge,
} from '../services/verification.service.js'
import {
  availableTransitions,
  createBooking,
  getBookingOrder,
  listBookings,
  loadBooking,
  payBooking,
  reassignBooking,
  reserveBooking,
  returnAtStation,
  scanBagOut,
  settleBooking,
  transitionBooking,
} from '../services/booking.service.js'
import { bookingDTO, bookingListWithDue } from '../services/serializers.js'
import { buildInvoice, whatsAppInvoice } from '../services/invoice.service.js'
import { PAYMENT_METHODS } from '../domain/types.js'
import { CARD_SCHEMES } from '../domain/commission.js'
import { bookingRefundPosition } from '../services/till.service.js'
import { canApproveRefund, pendingRefundRequest, requestRefund } from '../services/refundRequest.service.js'

const bagSchema = z.object({
  category: z.enum(['SOFT', 'HARD', 'OVERSIZE', 'FRAGILE']).optional(),
  description: z.string().optional(),
  dimensions: z.object({ w: z.number(), h: z.number(), d: z.number() }).optional(),
  weight: z.number().optional(),
})
const createSchema = z.object({
  customerId: z.string().min(1),
  engineKind: z.enum(ENGINE_KINDS),
  productId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  durationMin: z.number().int().positive().optional(),
  rateMode: z.enum(['HOURS', 'TOURS']).optional(),
  tours: z.number().int().positive().optional(),
  unitId: z.string().min(1).optional(),
  bags: z.array(bagSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const paySchema = z.object({
  splits: z
    .array(
      z.object({
        method: z.enum(PAYMENT_METHODS),
        cardScheme: z.enum(CARD_SCHEMES).nullable().optional(),
        amount: z.number().positive(),
        kind: z.string().optional(),
      }),
    )
    .min(1),
})
const transitionSchema = z.object({
  code: z.string().min(1),
  payload: z
    .object({
      scannedUnitId: z.string().optional(),
      scannedBarcodes: z.array(z.string()).optional(),
      unitId: z.string().optional(),
      reason: z.string().optional(),
      durationMin: z.number().int().positive().optional(),
      inspectionDone: z.boolean().optional(),
      safetyAck: z.boolean().optional(),
      boardingVerified: z.boolean().optional(),
    })
    .optional(),
})

const purposeSchema = z.enum(VERIFICATION_PURPOSES).default('RETRIEVAL')
const documentSchema = z.object({
  documentType: z.enum(ID_DOCUMENT_TYPES),
  documentNumber: z.string().min(4),
  holderName: z.string().min(2),
  image: z.string().optional(),
})
const confirmVerificationSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('WHATSAPP_OTP'), purpose: purposeSchema, code: z.string().min(1) }),
  z.object({ method: z.literal('EMAIL_OTP'), purpose: purposeSchema, code: z.string().min(1) }),
  z.object({ method: z.literal('ID_DOCUMENT'), purpose: purposeSchema, reason: z.string().min(3), document: documentSchema }),
  z.object({
    method: z.literal('MANAGER_OVERRIDE'),
    purpose: purposeSchema,
    reason: z.string().min(3),
    authoriserEmail: z.string().email(),
    authoriserPassword: z.string().min(1),
    document: documentSchema.optional(),
  }),
])

const refundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(3, 'A refund needs a reason.'),
})

const whatsappSchema = z.object({ pdfBase64: z.string().min(16) })

const returnSchema = z.object({
  code: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const bookingController = {
  create: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const { booking, order } = await createBooking(s, createSchema.parse(req.body))
    res.status(201).json({ success: true, data: { booking: bookingDTO(booking), order } })
  }),

  list: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const list = await listBookings(s, { status: req.query.status as string | undefined, engineKind: req.query.engineKind as never })
    res.json({ success: true, data: await bookingListWithDue(s.tenantId, list) })
  }),

  get: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: bookingDTO(await loadBooking(s, req.params.id)) })
  }),

  order: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: await getBookingOrder(s, req.params.id) })
  }),

  invoice: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: await buildInvoice(s, await loadBooking(s, req.params.id)) })
  }),

  transitions: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const booking = await loadBooking(s, req.params.id)
    res.json({ success: true, data: availableTransitions(booking, [s.role]) })
  }),

  pay: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const { splits } = paySchema.parse(req.body)
    const { booking, order, receipt } = await payBooking(s, req.params.id, splits)
    res.json({ success: true, data: { booking: bookingDTO(booking), order, receipt } })
  }),

  reserve: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const unitId = z.object({ unitId: z.string().optional() }).parse(req.body ?? {}).unitId
    res.json({ success: true, data: bookingDTO(await reserveBooking(s, req.params.id, unitId)) })
  }),

  reassign: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = z.object({ unitId: z.string().min(1), reason: z.string().min(1) }).parse(req.body)
    res.json({ success: true, data: bookingDTO(await reassignBooking(s, req.params.id, body.unitId, body.reason)) })
  }),

  settle: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const { splits } = paySchema.parse(req.body)
    const result = await settleBooking(s, req.params.id, splits)
    res.json({
      success: true,
      data: { booking: bookingDTO(result.booking), order: result.order, collected: result.collected, due: result.due },
    })
  }),

  whatsappInvoice: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = whatsappSchema.parse(req.body)
    const booking = await loadBooking(s, req.params.id)
    const pdf = Buffer.from(body.pdfBase64, 'base64')
    if (pdf.length === 0) throw ApiError.badRequest('The invoice came through empty.')
    if (pdf.length > 5_000_000) throw ApiError.badRequest('That invoice is too large to send.')
    res.json({ success: true, data: await whatsAppInvoice(s, booking, pdf) })
  }),

  returnHere: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = returnSchema.parse(req.body ?? {})
    const { booking, wrongStation } = await returnAtStation(s, req.params.id, body.code, body.payload ?? {})
    res.json({ success: true, data: { booking: bookingDTO(booking), wrongStation } })
  }),

  scanOut: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = z.object({ barcode: z.string().min(1) }).parse(req.body)
    res.json({ success: true, data: bookingDTO(await scanBagOut(s, req.params.id, body.barcode)) })
  }),

  refundPosition: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const booking = await loadBooking(s, req.params.id)
    const position = await bookingRefundPosition(s.tenantId, s.stationId, booking)
    res.json({
      success: true,
      data: {
        paid: position.paid,
        refunded: position.refunded,
        refundable: position.refundable,
        methods: [...new Set(position.payments.map((p) => p.method))],
        pending: await pendingRefundRequest(s.tenantId, booking._id),
        canApprove: canApproveRefund(s.role),
      },
    })
  }),

  refund: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = refundSchema.parse(req.body)
    const result = await requestRefund(s, req.params.id, body)
    res.json({
      success: true,
      data: {
        approved: result.approved,
        request: result.request,
        booking: 'booking' in result && result.booking ? bookingDTO(result.booking) : undefined,
        refunded: result.refunded,
        refundable: result.refundable,
      },
    })
  }),

  transition: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = transitionSchema.parse(req.body)
    res.json({ success: true, data: bookingDTO(await transitionBooking(s, req.params.id, body.code, body.payload ?? {})) })
  }),

  sendVerification: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const { purpose, channel } = z
      .object({ purpose: purposeSchema, channel: z.enum(['WHATSAPP', 'EMAIL']).default('WHATSAPP') })
      .parse(req.body ?? {})
    res.json({ success: true, data: await sendVerificationChallenge(s, req.params.id, purpose, channel) })
  }),

  confirmVerification: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = confirmVerificationSchema.parse(req.body)
    res.json({ success: true, data: bookingDTO(await confirmVerification(s, req.params.id, body)) })
  }),

  verificationEvidence: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: await getEvidence(s, req.params.id, req.params.evidenceId) })
  }),
}
