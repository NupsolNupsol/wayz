import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { dashboardStats } from '../services/dashboard.service.js'

export const dashboardController = {
  stats: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await dashboardStats(scopeFromReq(req)) })
  }),
}
