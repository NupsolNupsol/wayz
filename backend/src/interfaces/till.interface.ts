import type { CashMovementKind } from '../models/index.js'

export interface DrawerBreakdown {
  shiftId: string
  openedAt: Date
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

export interface MovementInput {
  kind: CashMovementKind
  amount: number
  reason: string
  reference?: string
}

export interface TransactionFilters {
  from?: string
  to?: string
  method?: string
  kind?: string
  shiftId?: string
}

export interface RefundInput {
  amount: number
  reason: string
}
