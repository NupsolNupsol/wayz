import type { Booking, Order } from '@/api/types'
import { ENGINE_META } from '@/config/engineMeta'

const PRE_FULFILMENT: Booking['status'][] = ['DRAFT', 'CONFIRMED', 'RESERVED', 'PREPARING']

export function isUnfinishedSale(booking: Pick<Booking, 'status'>, order?: Pick<Order, 'status'> | null): boolean {
  if (!PRE_FULFILMENT.includes(booking.status)) return false
  // A sale is unfinished while it is still waiting to be paid. A cancelled one is over — a booking
  // refunded in full leaves its order cancelled, and picking that up as a sale to resume would drop
  // the agent into a fresh payment for money that has just gone back to the customer.
  if (!order) return true
  return order.status === 'DRAFT' || order.status === 'AWAITING_PAYMENT'
}

export function resumeRoute(booking: Pick<Booking, 'id' | 'engineKind'>): string {
  const route = ENGINE_META[booking.engineKind]?.route ?? '/pos'
  return `${route}?resume=${booking.id}`
}
