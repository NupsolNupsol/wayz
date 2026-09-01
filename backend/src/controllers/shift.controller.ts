import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { getOpenShift, openShift, resolveVariance, submitBlindCount } from '../services/shift.service.js'

export const shiftController = {
  current: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getOpenShift(scopeFromReq(req)) })
  }),

  open: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await openShift(scopeFromReq(req)) })
  }),

  blindCount: asyncHandler(async (req, res) => {
    const { countedCash } = z.object({ countedCash: z.number().nonnegative() }).parse(req.body)
    res.json({ success: true, data: await submitBlindCount(scopeFromReq(req), req.params.id, countedCash) })
  }),

  resolve: asyncHandler(async (req, res) => {
    const { note } = z.object({ note: z.string().min(1) }).parse(req.body)
    res.json({ success: true, data: await resolveVariance(scopeFromReq(req), req.params.id, note) })
  }),
}
