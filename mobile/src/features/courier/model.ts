import type { IconName } from '@/components/Icon'
import type { TrailStep } from '@/design'
import type { Tone } from '@/theme/tokens'

import type { Delivery, DeliveryStatus } from './types'

/**
 * What each state of a run means to the person carrying the bags.
 *
 * The API returns a status; everything the screen shows for it — the word, the colour, the icon,
 * the sentence telling the courier what to do next — is decided here, once.
 */
export interface StatusMeta {
  label: string
  hint: string
  tone: Tone
  icon: IconName
  /** Index into DELIVERY_TRAIL, or -1 for a run that ended badly. */
  step: number
}

export const DELIVERY_TRAIL: TrailStep[] = [
  { key: 'claim', label: 'Claim', icon: 'Hand' },
  { key: 'collect', label: 'Collect', icon: 'PackageOpen' },
  { key: 'carry', label: 'Carry', icon: 'Truck' },
  { key: 'deliver', label: 'Deliver', icon: 'PackageCheck' },
]

const META: Record<DeliveryStatus, StatusMeta> = {
  REQUESTED: {
    label: 'Open',
    hint: 'Nobody has taken this yet — first one there gets it.',
    tone: 'warn',
    icon: 'Hand',
    step: 0,
  },
  ASSIGNED: {
    label: 'Yours',
    hint: 'Head to the desk and ask the agent for the bags.',
    tone: 'info',
    icon: 'Navigation',
    step: 1,
  },
  RELEASE_REQUESTED: {
    label: 'Waiting',
    hint: 'The agent has been asked to release the bags to you.',
    tone: 'warn',
    icon: 'Hourglass',
    step: 1,
  },
  RELEASE_APPROVED: {
    label: 'Released',
    hint: 'Scan every bag as you take it, then confirm.',
    tone: 'brand',
    icon: 'ScanLine',
    step: 1,
  },
  PICKED_UP: {
    label: 'Carrying',
    hint: 'Take them to the customer, then close the run.',
    tone: 'info',
    icon: 'Truck',
    step: 2,
  },
  DELIVERED: {
    label: 'Delivered',
    hint: 'Handed to the customer. Nothing left to do.',
    tone: 'success',
    icon: 'PackageCheck',
    step: 3,
  },
  FAILED: {
    label: 'Problem',
    hint: 'Reported. The desk that raised it will pick it up.',
    tone: 'danger',
    icon: 'AlertTriangle',
    step: -1,
  },
  CANCELLED: {
    label: 'Cancelled',
    hint: 'This run was called off.',
    tone: 'neutral',
    icon: 'X',
    step: -1,
  },
}

const UNKNOWN: StatusMeta = { label: '—', hint: '', tone: 'neutral', icon: 'Package', step: 0 }

export const meta = (status: DeliveryStatus | string): StatusMeta => META[status as DeliveryStatus] ?? UNKNOWN

export const FINISHED: DeliveryStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED']

export const isFinished = (d: Pick<Delivery, 'status'>) => FINISHED.includes(d.status)

/** How many bags the courier physically has on them right now. */
export function bagsInHand(detail: { delivery: Delivery; bags: { index: number }[]; stops?: { status: string; bagCount: number }[] }) {
  const stops = detail.stops ?? detail.delivery.stops ?? []
  if (stops.length > 1) {
    return stops.filter((s) => s.status === 'COLLECTED').reduce((sum, s) => sum + s.bagCount, 0)
  }
  return detail.bags.length
}

/** The single sentence to put in front of the courier for the state they are in. */
export function nextMove(d: Delivery, kioskName?: string | null): string {
  switch (d.status) {
    case 'REQUESTED':
      return 'Take this run to start it.'
    case 'ASSIGNED':
      return kioskName
        ? `Go to ${kioskName} and ask the agent for the bags.`
        : 'Go to the desk and ask the agent for the bags.'
    case 'RELEASE_REQUESTED':
      return 'The agent is checking you in. Show them your name.'
    case 'RELEASE_APPROVED':
      return 'Scan each bag as you take it out.'
    case 'PICKED_UP':
      return `Deliver to ${d.destination.address}.`
    default:
      return meta(d.status).hint
  }
}

/** Minutes from claiming a run to closing it, for the history list. */
export function minutesTaken(d: Delivery): number | null {
  if (!d.assignedAt) return null
  const end = d.deliveredAt ?? d.updatedAt
  if (!end) return null
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(d.assignedAt).getTime()) / 60_000))
}

const DAY_MS = 86_400_000

/** The last seven days of closed runs, oldest first, for the chart on the home screen. */
export function weeklyDelivered(history: Delivery[]): { label: string; value: number }[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const start = today.getTime() - (6 - i) * DAY_MS
    const value = history.filter((h) => {
      if (h.status !== 'DELIVERED') return false
      const at = new Date(h.deliveredAt ?? h.updatedAt).getTime()
      return at >= start && at < start + DAY_MS
    }).length
    return { label: days[new Date(start).getDay()] ?? '', value }
  })
}

export const deliveredToday = (history: Delivery[]): number => {
  const today = new Date().toDateString()
  return history.filter((h) => h.status === 'DELIVERED' && new Date(h.deliveredAt ?? h.updatedAt).toDateString() === today)
    .length
}
