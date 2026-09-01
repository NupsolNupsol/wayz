import i18n from '@/i18n'
import type { DeliveryStatus } from '@/api/delivery.api'
import type { Tone } from '@/components/status'

export interface DeliveryStatusMeta {
  labelKey: string
  hintKey: string
  tone: Tone
  icon: string
  step: number
}

export const DELIVERY_META: Record<DeliveryStatus, DeliveryStatusMeta> = {
  REQUESTED: { labelKey: 'delivery:state.REQUESTED.label', hintKey: 'delivery:state.REQUESTED.hint', tone: 'warning', icon: 'Bell', step: 0 },
  ASSIGNED: { labelKey: 'delivery:state.ASSIGNED.label', hintKey: 'delivery:state.ASSIGNED.hint', tone: 'info', icon: 'MapPin', step: 1 },
  RELEASE_REQUESTED: { labelKey: 'delivery:state.RELEASE_REQUESTED.label', hintKey: 'delivery:state.RELEASE_REQUESTED.hint', tone: 'warning', icon: 'Clock', step: 2 },
  RELEASE_APPROVED: { labelKey: 'delivery:state.RELEASE_APPROVED.label', hintKey: 'delivery:state.RELEASE_APPROVED.hint', tone: 'info', icon: 'PackageOpen', step: 3 },
  PICKED_UP: { labelKey: 'delivery:state.PICKED_UP.label', hintKey: 'delivery:state.PICKED_UP.hint', tone: 'info', icon: 'Truck', step: 4 },
  DELIVERED: { labelKey: 'delivery:state.DELIVERED.label', hintKey: 'delivery:state.DELIVERED.hint', tone: 'success', icon: 'PackageCheck', step: 5 },
  CANCELLED: { labelKey: 'delivery:state.CANCELLED.label', hintKey: 'delivery:state.CANCELLED.hint', tone: 'neutral', icon: 'Circle', step: -1 },
  FAILED: { labelKey: 'delivery:state.FAILED.label', hintKey: 'delivery:state.FAILED.hint', tone: 'danger', icon: 'TriangleAlert', step: -1 },
}

export const DELIVERY_STEPS = [
  { key: 'REQUESTED', labelKey: 'delivery:step.REQUESTED' },
  { key: 'ASSIGNED', labelKey: 'delivery:step.ASSIGNED' },
  { key: 'RELEASE_REQUESTED', labelKey: 'delivery:step.RELEASE_REQUESTED' },
  { key: 'RELEASE_APPROVED', labelKey: 'delivery:step.RELEASE_APPROVED' },
  { key: 'PICKED_UP', labelKey: 'delivery:step.PICKED_UP' },
  { key: 'DELIVERED', labelKey: 'delivery:step.DELIVERED' },
] as const

export const meta = (status: DeliveryStatus): DeliveryStatusMeta => DELIVERY_META[status] ?? DELIVERY_META.REQUESTED

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60_000)
  if (abs < 60_000) return diff < 0 ? 'just now' : 'in a moment'
  if (mins < 60) return diff < 0 ? i18n.t('common:time.minsAgo', { count: mins }) : i18n.t('common:time.inMins', { count: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return diff < 0 ? i18n.t('common:time.hoursAgo', { count: hours }) : i18n.t('common:time.inHours', { count: hours })
  return new Date(iso).toLocaleDateString()
}

export function secondsLeft(expiresAt: string | null, now = Date.now()): number {
  if (!expiresAt) return 0
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
}

export const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
