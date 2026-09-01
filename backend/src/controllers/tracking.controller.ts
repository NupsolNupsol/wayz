import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getPublicTracking } from '../services/tracking.service.js'

const paramsSchema = z.object({ id: z.string().trim().min(10).max(64).regex(/^[A-Za-z0-9_-]+$/) })

export const trackingController = {
  get: asyncHandler(async (req, res) => {
    const { id } = paramsSchema.parse(req.params)
    res.setHeader('Cache-Control', 'public, max-age=5')
    res.json({ success: true, data: await getPublicTracking(id) })
  }),
}
