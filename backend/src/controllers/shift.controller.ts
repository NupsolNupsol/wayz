import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { forceCloseShift, getOpenShift, openShift, resolveVariance, submitBlindCount } from '../services/shift.service.js'

export const shiftController = {
  current: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getOpenShift(scopeFromReq(req)) })
  }),

  open: asyncHandler(async (req, res) => {
    const { openingFloat } = z.object({ openingFloat: z.number().nonnegative().optional() }).parse(req.body ?? {})
    res.status(201).json({ success: true, data: await openShift(scopeFromReq(req), openingFloat ?? 0) })
  }),

  blindCount: asyncHandler(async (req, res) => {
    const { countedCash } = z.object({ countedCash: z.number().nonnegative() }).parse(req.body)
    res.json({ success: true, data: await submitBlindCount(scopeFromReq(req), req.params.id, countedCash) })
  }),

  forceClose: asyncHandler(async (req, res) => {
    const body = z
      .object({ countedCash: z.number().nonnegative(), reason: z.string().min(3, 'Say why the till is being closed for them.') })
      .parse(req.body)
    res.json({ success: true, data: await forceCloseShift(scopeFromReq(req), req.params.id, body) })
  }),

  resolve: asyncHandler(async (req, res) => {
    const { note } = z.object({ note: z.string().min(1) }).parse(req.body)
    res.json({ success: true, data: await resolveVariance(scopeFromReq(req), req.params.id, note) })
  }),
}
