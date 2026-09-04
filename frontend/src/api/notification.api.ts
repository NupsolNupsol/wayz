import { http, unwrap } from './client'
import type { EngineKind } from './types'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'danger'

export interface AppNotification {
  _id: string
  title: string
  body: string
  level: NotificationLevel
  link: string | null
  engineKind: EngineKind | null
  stationId: string | null
  createdAt: string
  read: boolean
}

export interface NotificationFeed {
  items: AppNotification[]
  unread: number
}

export const notificationApi = {
  list: (params?: { unreadOnly?: boolean; limit?: number }) =>
    unwrap<NotificationFeed>(
      http.get('/notifications', {
        params: {
          ...(params?.unreadOnly ? { unreadOnly: 'true' } : {}),
          ...(params?.limit ? { limit: params.limit } : {}),
        },
      }),
    ),
  markRead: (id: string) => unwrap<{ ok: boolean }>(http.post(`/notifications/${id}/read`, {})),
  markAllRead: () => unwrap<{ ok: boolean; cleared: number }>(http.post('/notifications/read-all', {})),
}
