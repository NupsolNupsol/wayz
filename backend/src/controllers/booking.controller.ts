import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
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
  scanBagOut,
  transitionBooking,
} from '../services/booking.service.js'
import { bookingDTO } from '../services/serializers.js'
import { PAYMENT_METHODS } from '../domain/types.js'
import { CARD_SCHEMES } from '../domain/commission.js'
import { bookingRefundPosition, refundBooking } from '../services/cashier.service.js'
import { User } from '../models/index.js'

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

export const bookingController = {
  create: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const { booking, order } = await createBooking(s, createSchema.parse(req.body))
    res.status(201).json({ success: true, data: { booking: bookingDTO(booking), order } })
  }),

  list: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const list = await listBookings(s, { status: req.query.status as string | undefined, engineKind: req.query.engineKind as never })
    res.json({ success: true, data: list.map(bookingDTO) })
  }),

  get: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: bookingDTO(await loadBooking(s, req.params.id)) })
  }),

  order: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: await getBookingOrder(s, req.params.id) })
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
      },
    })
  }),

  refund: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = refundSchema.parse(req.body)
    const booking = await loadBooking(s, req.params.id)
    const actor = await User.findById(s.agentId, { fullName: 1 }).lean()
    const result = await refundBooking(s, booking, body, actor?.fullName ?? s.agentId)
    res.json({
      success: true,
      data: {
        booking: bookingDTO(result.booking),
        paid: result.paid,
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
