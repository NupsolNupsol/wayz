import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '../api/notification.api'
import { qk } from './queryKeys'
import { NOTIFICATION_POLL_MS } from './pollIntervals'

export function useNotifications(params?: { unreadOnly?: boolean; limit?: number }) {
  return useQuery({
    queryKey: qk.notifications.feed(params ?? {}),
    queryFn: () => notificationApi.list(params),
    refetchInterval: NOTIFICATION_POLL_MS,
  })
}

function useInvalidateNotifications() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['notifications'] })
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications()
  return useMutation({ mutationFn: notificationApi.markRead, onSuccess: invalidate })
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications()
  return useMutation({ mutationFn: notificationApi.markAllRead, onSuccess: invalidate })
}
