import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingApi, type ConfirmVerificationInput, type CreateBookingInput, type TransitionPayload } from '../api/booking.api'
import { qk } from './queryKeys'
import type { EngineKind, OtpChannel, PaymentMethod, VerificationPurpose } from '../api/types'

export const useBookings = (filter?: { status?: string; engineKind?: EngineKind }) => useQuery({ queryKey: qk.bookings(filter), queryFn: () => bookingApi.list(filter) })
export const useBooking = (id: string | undefined) => useQuery({ queryKey: qk.booking(id ?? ''), queryFn: () => bookingApi.get(id!), enabled: !!id })
export const useBookingOrder = (id: string | undefined) => useQuery({ queryKey: qk.bookingOrder(id ?? ''), queryFn: () => bookingApi.order(id!), enabled: !!id })
export const useRefundPosition = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: qk.bookingRefund(id ?? ''), queryFn: () => bookingApi.refundPosition(id!), enabled: !!id && enabled })

export const useTransitions = (id: string | undefined) => useQuery({ queryKey: qk.transitions(id ?? ''), queryFn: () => bookingApi.transitions(id!), enabled: !!id })


export function useInvalidateBooking() {
  const qc = useQueryClient()
  return async (id?: string) => {
    if (id) {
      await Promise.all([
        qc.refetchQueries({ queryKey: qk.booking(id) }),
        qc.refetchQueries({ queryKey: qk.transitions(id) }),
      ])
    }
    qc.invalidateQueries({ queryKey: ['bookings'] })
    qc.invalidateQueries({ queryKey: qk.dashboard })
    qc.invalidateQueries({ queryKey: qk.units })
    qc.invalidateQueries({ queryKey: ['cashier'] })
    qc.invalidateQueries({ queryKey: qk.shift })
  }
}


export function useCreateBooking() {
  const invalidate = useInvalidateBooking()
  return useMutation({ mutationFn: (input: CreateBookingInput) => bookingApi.create(input), onSuccess: () => invalidate() })
}
export function usePay() {
  const invalidate = useInvalidateBooking()
  return useMutation({
    mutationFn: (v: { id: string; splits: { method: PaymentMethod; amount: number; kind?: string }[] }) => bookingApi.pay(v.id, v.splits),
    onSuccess: (_d, v) => invalidate(v.id),
  })
}
export function useReserve() {
  const invalidate = useInvalidateBooking()
  return useMutation({ mutationFn: (v: { id: string; unitId?: string }) => bookingApi.reserve(v.id, v.unitId), onSuccess: (_d, v) => invalidate(v.id) })
}
export function useReassign() {
  const invalidate = useInvalidateBooking()
  return useMutation({ mutationFn: (v: { id: string; unitId: string; reason: string }) => bookingApi.reassign(v.id, v.unitId, v.reason), onSuccess: (_d, v) => invalidate(v.id) })
}
export function useScanOut() {
  const invalidate = useInvalidateBooking()
  return useMutation({ mutationFn: (v: { id: string; barcode: string }) => bookingApi.scanOut(v.id, v.barcode), onSuccess: (_d, v) => invalidate(v.id) })
}
export function useTransition() {
  const invalidate = useInvalidateBooking()
  return useMutation({ mutationFn: (v: { id: string; code: string; payload?: TransitionPayload }) => bookingApi.transition(v.id, v.code, v.payload), onSuccess: (_d, v) => invalidate(v.id) })
}
export function useSendVerification() {
  return useMutation({
    mutationFn: (v: { id: string; channel?: OtpChannel; purpose?: VerificationPurpose }) =>
      bookingApi.sendVerification(v.id, v.purpose ?? 'RETRIEVAL', v.channel),
  })
}
export function useConfirmVerification() {
  const invalidate = useInvalidateBooking()
  return useMutation({
    mutationFn: (v: { id: string; input: ConfirmVerificationInput; purpose?: VerificationPurpose }) =>
      bookingApi.confirmVerification(v.id, v.input, v.purpose ?? 'RETRIEVAL'),
    onSuccess: (_d, v) => invalidate(v.id),
  })
}

export function useRefundBooking() {
  const invalidate = useInvalidateBooking()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; amount?: number; reason: string }) =>
      bookingApi.refund(v.id, { amount: v.amount, reason: v.reason }),
    onSuccess: async (_d, v) => {
      await invalidate(v.id)
      qc.invalidateQueries({ queryKey: qk.bookingRefund(v.id) })
      qc.invalidateQueries({ queryKey: ['accounting'] })
    },
  })
}
