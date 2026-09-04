import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tripApi } from '../api/trip.api'
import { OPERATIONS_POLL_MS } from './pollIntervals'

const KEY = ['lagoon', 'trips'] as const

export const useWaitingForBoats = (enabled = true) =>
  useQuery({ queryKey: [...KEY, 'waiting'], queryFn: tripApi.waiting, enabled, refetchInterval: OPERATIONS_POLL_MS, staleTime: 0 })

export const useTripBoard = (mine = false, enabled = true) =>
  useQuery({ queryKey: [...KEY, 'board', mine], queryFn: () => tripApi.board(mine), enabled, refetchInterval: OPERATIONS_POLL_MS, staleTime: 0 })

export const useTrip = (id: string | undefined) =>
  useQuery({ queryKey: [...KEY, id ?? ''], queryFn: () => tripApi.detail(id!), enabled: !!id, refetchInterval: OPERATIONS_POLL_MS, staleTime: 0 })

function useTripMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export const usePlanTrips = () => useTripMutation(() => tripApi.plan())
export const useClaimTrip = () => useTripMutation((id: string) => tripApi.claim(id))
export const useStartTrip = () => useTripMutation((v: { id: string; unitId?: string }) => tripApi.start(v.id, v.unitId))
export const useClockStation = () => useTripMutation((v: { id: string; stationId: string }) => tripApi.clock(v.id, v.stationId))
export const useCompleteTrip = () => useTripMutation((id: string) => tripApi.complete(id))
export const useSetTripRoute = () =>
  useTripMutation((v: { id: string; stationIds: string[] }) => tripApi.setRoute(v.id, v.stationIds))
