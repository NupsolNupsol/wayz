import type { Booking, Order } from '@/api/types'
import { ENGINE_META } from '@/config/engineMeta'

const PRE_FULFILMENT: Booking['status'][] = ['DRAFT', 'CONFIRMED', 'RESERVED', 'PREPARING']

export function isUnfinishedSale(booking: Pick<Booking, 'status'>, order?: Pick<Order, 'status'> | null): boolean {
  if (!PRE_FULFILMENT.includes(booking.status)) return false
  return !order || order.status !== 'PAID'
}

export function resumeRoute(booking: Pick<Booking, 'id' | 'engineKind'>): string {
  const route = ENGINE_META[booking.engineKind]?.route ?? '/pos'
  return `${route}?resume=${booking.id}`
}
