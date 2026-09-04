import { http, unwrap } from './client'
import type { EngineKind } from './types'

export type RefundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface RefundRequest {
  _id: string
  ref: string
  bookingId: string
  bookingRef: string
  engineKind: EngineKind
  customerName: string
  amount: number
  reason: string
  status: RefundRequestStatus
  requestedBy: string
  requestedByName: string
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string
  createdAt: string
}

export interface RefundRequestFeed {
  canApprove: boolean
  rows: RefundRequest[]
  pendingTotal: number
}

export const refundRequestApi = {
  list: (params?: { status?: RefundRequestStatus }) =>
    unwrap<RefundRequestFeed>(http.get('/refund-requests', { params })),
  review: (id: string, decision: { approve: boolean; note?: string }) =>
    unwrap<RefundRequest>(http.post(`/refund-requests/${id}/review`, decision)),
}
