import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tillApi } from '../api/till.api'
import { qk } from './queryKeys'
import type { PaymentMethod } from '../api/types'
import { TILL_POLL_MS } from './pollIntervals'

export function useTillOverview(enabled = true) {
  return useQuery({ queryKey: qk.till.overview, queryFn: tillApi.overview, enabled, refetchInterval: TILL_POLL_MS })
}

export function useTillQueue(enabled = true) {
  return useQuery({ queryKey: qk.till.queue, queryFn: tillApi.queue, enabled, refetchInterval: TILL_POLL_MS })
}

export function useTillTransactions(params?: { method?: PaymentMethod; kind?: string; from?: string; to?: string; shiftId?: string }) {
  return useQuery({ queryKey: qk.till.transactions(params ?? {}), queryFn: () => tillApi.transactions(params) })
}

export function useTillDrawer(shiftId?: string) {
  return useQuery({ queryKey: qk.till.drawer(shiftId ?? 'open'), queryFn: () => tillApi.drawer(shiftId) })
}

function useInvalidateTill() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['till'] })
    qc.invalidateQueries({ queryKey: qk.shift })
  }
}

export function useRecordMovement() {
  const invalidate = useInvalidateTill()
  return useMutation({ mutationFn: tillApi.movement, onSuccess: invalidate })
}

export function useRefundPayment() {
  const invalidate = useInvalidateTill()
  return useMutation({
    mutationFn: (v: { paymentId: string; amount: number; reason: string }) =>
      tillApi.refund(v.paymentId, { amount: v.amount, reason: v.reason }),
    onSuccess: invalidate,
  })
}

