import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deliveryApi, type CreateDeliveryInput, type DeliveryTransitionPayload } from '../api/delivery.api'
import { qk } from './queryKeys'
import { DELIVERY_POLL_MS } from './pollIntervals'

export function useCourierBoard(enabled = true) {
  return useQuery({ queryKey: qk.delivery.board, queryFn: deliveryApi.board, enabled, refetchInterval: DELIVERY_POLL_MS })
}

export function useStationDeliveries(params?: { status?: string; bookingId?: string }, enabled = true) {
  return useQuery({
    queryKey: qk.delivery.station(params ?? {}),
    queryFn: () => deliveryApi.station(params),
    enabled,
    refetchInterval: DELIVERY_POLL_MS,
  })
}

export function useDelivery(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.delivery.detail(id ?? ''),
    queryFn: () => deliveryApi.detail(id!),
    enabled: !!id && enabled,
    refetchInterval: DELIVERY_POLL_MS,
  })
}

function useInvalidateDeliveries() {
  const qc = useQueryClient()
  return async (id?: string) => {
    if (id) await qc.refetchQueries({ queryKey: qk.delivery.detail(id) })
    qc.invalidateQueries({ queryKey: ['delivery'] })
    qc.invalidateQueries({ queryKey: ['booking'] })
    qc.invalidateQueries({ queryKey: ['bookings'] })
  }
}

export function useCustomerBagsElsewhere(bookingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.delivery.customerBags(bookingId ?? ''),
    queryFn: () => deliveryApi.customerBags(bookingId!),
    enabled: !!bookingId && enabled,
    staleTime: 30_000,
  })
}

export function useCollectStop() {
  const invalidate = useInvalidateDeliveries()
  return useMutation({
    mutationFn: (v: { id: string; scannedBarcodes: string[] }) => deliveryApi.collectStop(v.id, v.scannedBarcodes),
    onSuccess: (_d, v) => invalidate(v.id),
  })
}

export function useCreateDelivery() {
  const invalidate = useInvalidateDeliveries()
  return useMutation({ mutationFn: (input: CreateDeliveryInput) => deliveryApi.create(input), onSuccess: () => invalidate() })
}

export function useCourierTransition() {
  const invalidate = useInvalidateDeliveries()
  return useMutation({
    mutationFn: (v: { id: string; code: string; payload?: DeliveryTransitionPayload }) =>
      deliveryApi.courierTransition(v.id, v.code, v.payload),
    onSuccess: (_d, v) => invalidate(v.id),
  })
}

export function useCollectOnDelivery() {
  const invalidate = useInvalidateDeliveries()
  return useMutation({
    mutationFn: (v: { id: string; splits: { method: 'CASH' | 'CARD'; cardScheme?: string | null; amount: number }[] }) =>
      deliveryApi.collect(v.id, v.splits),
    onSuccess: (_d, v) => invalidate(v.id),
  })
}

export function useStationDeliveryTransition() {
  const invalidate = useInvalidateDeliveries()
  return useMutation({
    mutationFn: (v: { id: string; code: string; payload?: DeliveryTransitionPayload }) =>
      deliveryApi.stationTransition(v.id, v.code, v.payload),
    onSuccess: (_d, v) => invalidate(v.id),
  })
}

