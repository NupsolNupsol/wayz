import { http, unwrap } from './client'
import type { CardScheme, EngineKind, PaymentMethod } from './types'

export type CashMovementKind = 'FLOAT_IN' | 'PAY_OUT' | 'DROP'

export interface CashMovement {
  _id: string
  shiftId: string
  actorId: string
  actorName: string
  kind: CashMovementKind
  amount: number
  reason: string
  reference: string
  createdAt: string
}

export interface DrawerBreakdown {
  shiftId: string
  openedAt: string
  status: string
  floatIn: number
  cashSales: number
  cashRefunds: number
  paidOut: number
  dropped: number
  derived: number
  expected: number
  drift: number
  cardSales: number
  movements: number
}

export interface QueuedPayment {
  bookingId: string
  ref: string
  orderId: string
  orderRef: string
  engineKind: EngineKind
  productName: string
  customerId: string
  customerName: string
  customerPhone: string
  items: number
  createdAt: string
  waitingMs: number
  subtotal: number
  vat: number
  depositTotal: number
  total: number
  orderStatus: string
}

export interface TillTransaction {
  _id: string
  amount: number
  method: PaymentMethod
  cardScheme: CardScheme | null
  kind: string
  status: 'PENDING' | 'CAPTURED' | 'REFUNDED'
  createdAt: string
  orderId: string
  bookingId: string | null
  bookingRef: string
  customerName: string
  productName: string
  engineKind: EngineKind | null
  receiptRef: string | null
  takenBy: string
  takenByName: string
}

export interface TillOverview {
  shift: { _id: string; status: string; openedAt: string; expectedCash: number } | null
  drawer: DrawerBreakdown | null
  queue: { count: number; value: number; oldestWaitingMs: number }
  today: { transactions: number; gross: number; refunded: number; net: number; cash: number; card: number }
  customers: number
}

export const tillApi = {
  overview: () => unwrap<TillOverview>(http.get('/till/overview')),
  queue: () => unwrap<QueuedPayment[]>(http.get('/till/queue')),
  transactions: (params?: { from?: string; to?: string; method?: PaymentMethod; kind?: string; shiftId?: string }) =>
    unwrap<TillTransaction[]>(http.get('/till/transactions', { params })),
  drawer: (shiftId?: string) =>
    unwrap<{ drawer: DrawerBreakdown | null; movements: CashMovement[] }>(
      http.get('/till/drawer', { params: shiftId ? { shiftId } : undefined }),
    ),
  movement: (input: { kind: CashMovementKind; amount: number; reason: string; reference?: string }) =>
    unwrap<CashMovement>(http.post('/till/drawer/movement', input)),
  refund: (paymentId: string, input: { amount: number; reason: string }) =>
    unwrap<{ refund: TillTransaction; remaining: number }>(http.post(`/till/payments/${paymentId}/refund`, input)),
}
