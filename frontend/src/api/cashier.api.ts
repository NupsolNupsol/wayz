import { http, unwrap } from './client'
import type { EngineKind, PaymentMethod } from './types'

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

export interface CashierTransaction {
  _id: string
  amount: number
  method: PaymentMethod
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

export interface CashierOverview {
  shift: { _id: string; status: string; openedAt: string; expectedCash: number } | null
  drawer: DrawerBreakdown | null
  queue: { count: number; value: number; oldestWaitingMs: number }
  today: { transactions: number; gross: number; refunded: number; net: number; cash: number; card: number }
  customers: number
}

export const cashierApi = {
  overview: () => unwrap<CashierOverview>(http.get('/cashier/overview')),
  queue: () => unwrap<QueuedPayment[]>(http.get('/cashier/queue')),
  transactions: (params?: { from?: string; to?: string; method?: PaymentMethod; kind?: string }) =>
    unwrap<CashierTransaction[]>(http.get('/cashier/transactions', { params })),
  drawer: (shiftId?: string) =>
    unwrap<{ drawer: DrawerBreakdown | null; movements: CashMovement[] }>(
      http.get('/cashier/drawer', { params: shiftId ? { shiftId } : undefined }),
    ),
  movement: (input: { kind: CashMovementKind; amount: number; reason: string; reference?: string }) =>
    unwrap<CashMovement>(http.post('/cashier/drawer/movement', input)),
  refund: (paymentId: string, input: { amount: number; reason: string }) =>
    unwrap<{ refund: CashierTransaction; remaining: number }>(http.post(`/cashier/payments/${paymentId}/refund`, input)),
}
