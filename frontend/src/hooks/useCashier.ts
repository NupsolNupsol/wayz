import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cashierApi } from '../api/cashier.api'
import { qk } from './queryKeys'
import type { PaymentMethod } from '../api/types'
import { TILL_POLL_MS } from './pollIntervals'

export function useCashierOverview(enabled = true) {
  return useQuery({ queryKey: qk.cashier.overview, queryFn: cashierApi.overview, enabled, refetchInterval: TILL_POLL_MS })
}

export function useCashierQueue(enabled = true) {
  return useQuery({ queryKey: qk.cashier.queue, queryFn: cashierApi.queue, enabled, refetchInterval: TILL_POLL_MS })
}

export function useCashierTransactions(params?: { method?: PaymentMethod; kind?: string; from?: string; to?: string }) {
  return useQuery({ queryKey: qk.cashier.transactions(params ?? {}), queryFn: () => cashierApi.transactions(params) })
}

export function useCashierDrawer(shiftId?: string) {
  return useQuery({ queryKey: qk.cashier.drawer(shiftId ?? 'open'), queryFn: () => cashierApi.drawer(shiftId) })
}

function useInvalidateTill() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['cashier'] })
    qc.invalidateQueries({ queryKey: qk.shift })
  }
}

export function useRecordMovement() {
  const invalidate = useInvalidateTill()
  return useMutation({ mutationFn: cashierApi.movement, onSuccess: invalidate })
}

export function useRefundPayment() {
  const invalidate = useInvalidateTill()
  return useMutation({
    mutationFn: (v: { paymentId: string; amount: number; reason: string }) =>
      cashierApi.refund(v.paymentId, { amount: v.amount, reason: v.reason }),
    onSuccess: invalidate,
  })
}

