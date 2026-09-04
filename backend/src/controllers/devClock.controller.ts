import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { ageBooking, isTimeTravelEnabled } from '../services/devClock.service.js'

const ageSchema = z.object({ minutes: z.coerce.number().int() })

export const devClockController = {
  status: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { enabled: isTimeTravelEnabled() } })
  }),

  age: asyncHandler(async (req, res) => {
    const body = ageSchema.parse(req.body)
    res.json({ success: true, data: await ageBooking(scopeFromReq(req), req.params.id, body.minutes) })
  }),
}
