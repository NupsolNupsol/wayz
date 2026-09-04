import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { devClockApi } from '../api/devClock.api'
import { qk } from './queryKeys'

export function useDevClock() {
  return useQuery({ queryKey: qk.devClock, queryFn: devClockApi.status, staleTime: Infinity })
}

export function useAgeBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; minutes: number }) => devClockApi.age(v.id, v.minutes),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: qk.booking(v.id) })
      qc.invalidateQueries({ queryKey: qk.transitions(v.id) })
      qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
