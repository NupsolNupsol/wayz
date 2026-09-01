import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { CASH_MOVEMENT_KINDS } from '../models/index.js'
import { PAYMENT_METHODS } from '../domain/types.js'
import {
  cashierOverview,
  drawer,
  listMovements,
  paymentQueue,
  recordMovement,
  refundPayment,
  transactions,
} from '../services/cashier.service.js'

const movementSchema = z.object({
  kind: z.enum(CASH_MOVEMENT_KINDS as unknown as [string, ...string[]]),
  amount: z.number().positive('Enter an amount greater than zero.'),
  reason: z.string().min(3, 'Every drawer movement needs a reason.'),
  reference: z.string().max(120).optional(),
})

const refundSchema = z.object({
  amount: z.number().positive('Enter an amount greater than zero.'),
  reason: z.string().min(3, 'A refund needs a reason.'),
})

const transactionQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  method: z.enum(PAYMENT_METHODS as unknown as [string, ...string[]]).optional(),
  kind: z.string().optional(),
})

export const cashierController = {
  overview: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await cashierOverview(scopeFromReq(req)) })
  }),

  queue: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await paymentQueue(scopeFromReq(req)) })
  }),

  transactions: asyncHandler(async (req, res) => {
    const filters = transactionQuery.parse(req.query)
    res.json({ success: true, data: await transactions(scopeFromReq(req), filters) })
  }),

  drawer: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const shiftId = typeof req.query.shiftId === 'string' ? req.query.shiftId : undefined
    res.json({
      success: true,
      data: { drawer: await drawer(s, shiftId), movements: await listMovements(s, shiftId) },
    })
  }),

  movement: asyncHandler(async (req, res) => {
    const body = movementSchema.parse(req.body)
    const movement = await recordMovement(scopeFromReq(req), { ...body, kind: body.kind as never })
    res.status(201).json({ success: true, data: movement })
  }),

  refund: asyncHandler(async (req, res) => {
    const body = refundSchema.parse(req.body)
    res.json({ success: true, data: await refundPayment(scopeFromReq(req), req.params.id, body) })
  }),
}
