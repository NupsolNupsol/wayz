import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { refundRequestApi, type RefundRequestStatus } from '../api/refundRequest.api'
import { qk } from './queryKeys'

export function useRefundRequests(params?: { status?: RefundRequestStatus }) {
  return useQuery({ queryKey: qk.refundRequests(params ?? {}), queryFn: () => refundRequestApi.list(params) })
}

export function useReviewRefundRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean; note?: string }) =>
      refundRequestApi.review(v.id, { approve: v.approve, note: v.note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refund-requests'] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['till'] })
    },
  })
}
