import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { listNotifications, markAllRead, markRead, unreadCount } from '../services/notification.service.js'

const listQuery = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const scope = scopeFromReq(req)
    const query = listQuery.parse(req.query)
    const [items, unread] = await Promise.all([
      listNotifications(scope, { unreadOnly: query.unreadOnly === 'true', limit: query.limit }),
      unreadCount(scope),
    ])
    res.json({ success: true, data: { items, unread } })
  }),

  read: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await markRead(scopeFromReq(req), req.params.id) })
  }),

  readAll: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await markAllRead(scopeFromReq(req)) })
  }),
}
