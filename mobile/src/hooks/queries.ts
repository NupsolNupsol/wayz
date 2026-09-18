import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  bookingApi,
  catalogueApi,
  customerApi,
  dashboardApi,
  deliveryApi,
  incidentApi,
  shiftApi,
  type CreateBookingInput,
  type PaymentSplit,
  type TransitionPayload,
} from '@/api/endpoints'
import type { EngineKind } from '@/types'

export const keys = {
  stats: ['stats'] as const,
  products: (engine?: EngineKind) => ['products', engine ?? 'all'] as const,
  units: ['units'] as const,
  customers: (q: string) => ['customers', q] as const,
  customer: (id: string) => ['customer', id] as const,
  bookings: (filter: object) => ['bookings', filter] as const,
  booking: (id: string) => ['booking', id] as const,
  order: (id: string) => ['booking', id, 'order'] as const,
  transitions: (id: string) => ['booking', id, 'transitions'] as const,
  deliveries: (filter: object) => ['deliveries', filter] as const,
  delivery: (id: string) => ['delivery', id] as const,
  shift: ['shift'] as const,
  incidents: ['incidents'] as const,
  incidentCatalogue: ['incidents', 'catalogue'] as const,
}

const LIVE = 15_000

export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: dashboardApi.stats, refetchInterval: LIVE })

export const useProducts = (engineKind?: EngineKind) =>
  useQuery({ queryKey: keys.products(engineKind), queryFn: () => catalogueApi.products(engineKind) })

export const useUnits = () => useQuery({ queryKey: keys.units, queryFn: catalogueApi.units })

export const useCustomers = (q: string) =>
  useQuery({ queryKey: keys.customers(q), queryFn: () => customerApi.list(q || undefined) })

export const useCustomer = (id?: string) =>
  useQuery({ queryKey: keys.customer(id ?? ''), queryFn: () => customerApi.get(id!), enabled: !!id })

export const useBookings = (filter: { status?: string; engineKind?: EngineKind } = {}) =>
  useQuery({ queryKey: keys.bookings(filter), queryFn: () => bookingApi.list(filter), refetchInterval: LIVE })

export const useBooking = (id?: string) =>
  useQuery({ queryKey: keys.booking(id ?? ''), queryFn: () => bookingApi.get(id!), enabled: !!id })

export const useOrder = (id?: string) =>
  useQuery({ queryKey: keys.order(id ?? ''), queryFn: () => bookingApi.order(id!), enabled: !!id })

export const useTransitions = (id?: string) =>
  useQuery({ queryKey: keys.transitions(id ?? ''), queryFn: () => bookingApi.transitions(id!), enabled: !!id })

export const useStationDeliveries = (filter: { status?: string; bookingId?: string } = {}, enabled = true) =>
  useQuery({
    queryKey: keys.deliveries(filter),
    queryFn: () => deliveryApi.station(filter),
    enabled,
    refetchInterval: LIVE,
  })

export const useDelivery = (id?: string) =>
  useQuery({ queryKey: keys.delivery(id ?? ''), queryFn: () => deliveryApi.get(id!), enabled: !!id, refetchInterval: 10_000 })

export const useShift = () => useQuery({ queryKey: keys.shift, queryFn: shiftApi.current })

export const useIncidents = () => useQuery({ queryKey: keys.incidents, queryFn: incidentApi.list })

export const useIncidentCatalogue = () =>
  useQuery({ queryKey: keys.incidentCatalogue, queryFn: incidentApi.catalogue, staleTime: Infinity })

function useBookingInvalidation() {
  const qc = useQueryClient()
  return (id?: string) => {
    if (id) {
      void qc.invalidateQueries({ queryKey: keys.booking(id) })
      void qc.invalidateQueries({ queryKey: ['booking', id] })
    }
    void qc.invalidateQueries({ queryKey: ['bookings'] })
    void qc.invalidateQueries({ queryKey: keys.stats })
    void qc.invalidateQueries({ queryKey: keys.units })
  }
}

export function useCreateBooking() {
  const refresh = useBookingInvalidation()
  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingApi.create(input),
    onSuccess: (result) => refresh(result.booking.id),
  })
}

export function usePay() {
  const refresh = useBookingInvalidation()
  return useMutation({
    mutationFn: ({ id, splits }: { id: string; splits: PaymentSplit[] }) => bookingApi.pay(id, splits),
    onSuccess: (_r, v) => refresh(v.id),
  })
}

export function useReserve() {
  const refresh = useBookingInvalidation()
  return useMutation({
    mutationFn: ({ id, unitId }: { id: string; unitId?: string }) => bookingApi.reserve(id, unitId),
    onSuccess: (_r, v) => refresh(v.id),
  })
}

export function useReassign() {
  const refresh = useBookingInvalidation()
  return useMutation({
    mutationFn: ({ id, unitId, reason }: { id: string; unitId: string; reason: string }) =>
      bookingApi.reassign(id, unitId, reason),
    onSuccess: (_r, v) => refresh(v.id),
  })
}

export function useScanOut() {
  const refresh = useBookingInvalidation()
  return useMutation({
    mutationFn: ({ id, barcode }: { id: string; barcode: string }) => bookingApi.scanOut(id, barcode),
    onSuccess: (_r, v) => refresh(v.id),
  })
}

export function useTransition() {
  const refresh = useBookingInvalidation()
  return useMutation({
    mutationFn: ({ id, code, payload }: { id: string; code: string; payload?: TransitionPayload }) =>
      bookingApi.transition(id, code, payload),
    onSuccess: (_r, v) => refresh(v.id),
  })
}

export function useSendVerification() {
  return useMutation({
    mutationFn: ({ id, channel }: { id: string; channel: 'WHATSAPP' | 'EMAIL' }) =>
      bookingApi.sendVerification(id, 'RETRIEVAL', channel),
  })
}

export function useConfirmVerification() {
  const refresh = useBookingInvalidation()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      bookingApi.confirmVerification(id, input),
    onSuccess: (_r, v) => refresh(v.id),
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; phone: string; email?: string }) => customerApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useCreateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof deliveryApi.create>[0]) => deliveryApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deliveries'] }),
  })
}

export function useDeliveryTransition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, code, payload }: { id: string; code: string; payload?: { compartmentCode?: string; reason?: string } }) =>
      deliveryApi.stationTransition(id, code, payload),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: keys.delivery(v.id) })
      void qc.invalidateQueries({ queryKey: ['deliveries'] })
    },
  })
}

export function useOpenShift() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: shiftApi.open, onSuccess: () => void qc.invalidateQueries({ queryKey: keys.shift }) })
}

export function useBlindCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, countedCash }: { id: string; countedCash: number }) => shiftApi.blindCount(id, countedCash),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.shift }),
  })
}

export function useCreateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof incidentApi.create>[0]) => incidentApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.incidents })
      void qc.invalidateQueries({ queryKey: keys.stats })
    },
  })
}
