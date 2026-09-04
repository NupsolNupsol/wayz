import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { readInvoicePdf } from '../services/invoice.service.js'
import { getPublicTracking } from '../services/tracking.service.js'

const paramsSchema = z.object({ id: z.string().trim().min(10).max(64).regex(/^[A-Za-z0-9_-]+$/) })

export const trackingController = {
  invoicePdf: asyncHandler(async (req, res) => {
    const doc = await readInvoicePdf(req.params.token)
    if (!doc) throw ApiError.notFound('That invoice link has expired.')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(doc.pdf)
  }),

  get: asyncHandler(async (req, res) => {
    const { id } = paramsSchema.parse(req.params)
    res.setHeader('Cache-Control', 'public, max-age=5')
    res.json({ success: true, data: await getPublicTracking(id) })
  }),
}
