import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { REFUND_REQUEST_STATUSES } from '../models/index.js'
import { listRefundRequests, reviewRefundRequest } from '../services/refundRequest.service.js'

const listQuery = z.object({ status: z.enum(REFUND_REQUEST_STATUSES).optional() })

const reviewSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(300).optional(),
})

export const refundRequestController = {
  list: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listRefundRequests(scopeFromReq(req), listQuery.parse(req.query)) })
  }),

  review: asyncHandler(async (req, res) => {
    const body = reviewSchema.parse(req.body)
    res.json({ success: true, data: await reviewRefundRequest(scopeFromReq(req), req.params.id, body) })
  }),
}
