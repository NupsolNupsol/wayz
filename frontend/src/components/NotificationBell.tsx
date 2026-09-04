import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { ArrowRight, Bell } from 'lucide-react'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks'
import { useAuthStore } from '@/store/auth'
import { resolveNotificationLink } from '@/features/notifications/resolveLink'
import { formatDateTime } from '@/utils'
import type { AppNotification, NotificationLevel } from '@/api/notification.api'

const DOT: Record<NotificationLevel, string> = {
  info: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-amber-500',
  danger: 'bg-danger-strong',
}

export function NotificationBell() {
  const { t } = useTranslation(['nav', 'common'])
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const role = useAuthStore((s) => s.me?.role)
  const { data } = useNotifications({ limit: 12 })
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const unread = data?.unread ?? 0
  const items = data?.items ?? []

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const openItem = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n._id)

    const target = resolveNotificationLink(n.link, role)
    if (!target) return
    setOpen(false)
    navigate(target)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-muted hover:bg-black/5"
        aria-label={t('nav:notifications.title')}
        data-testid="notification-bell"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            className="absolute top-0.5 end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-strong text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
            data-testid="notification-count"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+8px)] end-0 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto scroll-thin lf-card p-1 shadow-pop z-[9999]"
          data-testid="notification-dropdown"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold text-navy dark:text-dk-texthi">{t('nav:notifications.title')}</p>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-brand hover:underline"
                data-testid="notification-mark-all"
              >
                {t('nav:notifications.markAll')}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted" data-testid="notification-empty">
              {t('nav:notifications.emptyTitle')}
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n._id}
                onClick={() => openItem(n)}
                className={clsx(
                  'w-full flex items-start gap-2 px-3 py-2 rounded-lg text-start hover:bg-canvas dark:hover:bg-dk-elevated',
                  !n.read && 'bg-blue-50/50 dark:bg-dk-elevated',
                  resolveNotificationLink(n.link, role) ? 'cursor-pointer' : 'cursor-default',
                )}
                data-testid={`notification-item-${n._id}`}
              >
                <span className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', DOT[n.level])} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy dark:text-dk-texthi truncate">{n.title}</span>
                  <span className="block text-xs text-muted line-clamp-2">{n.body}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
                    <span className="tabular-nums">{formatDateTime(new Date(n.createdAt).getTime())}</span>
                    {resolveNotificationLink(n.link, role) && <ArrowRight size={11} className="text-brand rtl:rotate-180" />}
                  </span>
                </span>
              </button>
            ))
          )}

        </div>
      )}
    </div>
  )
}
