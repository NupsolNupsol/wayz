import { http, unwrap } from './client'
import type { EngineKind, PaymentMethod } from './types'

export type ManualSaleStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ManualSale {
  _id: string
  ref: string
  stationId: string
  stationName: string
  engineKind: EngineKind
  description: string
  amount: number
  baseAmount: number
  vatAmount: number
  vatRate: number
  method: PaymentMethod
  occurredAt: string
  status: ManualSaleStatus
  enteredBy: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string
  createdAt: string
}

export interface ManualSaleFeed {
  canApprove: boolean
  stations: { _id: string; name: string }[]
  rows: ManualSale[]
  pendingTotal: number
}

export interface ManualSaleInput {
  stationId: string
  engineKind: EngineKind
  description: string
  amount: number
  method: PaymentMethod
  occurredAt: string
}

export const manualSaleApi = {
  list: (params?: { status?: ManualSaleStatus; from?: string; to?: string }) =>
    unwrap<ManualSaleFeed>(http.get('/manual-sales', { params })),
  create: (input: ManualSaleInput) => unwrap<ManualSale>(http.post('/manual-sales', input)),
  review: (id: string, decision: { approve: boolean; note?: string }) =>
    unwrap<ManualSale>(http.post(`/manual-sales/${id}/review`, decision)),
}
