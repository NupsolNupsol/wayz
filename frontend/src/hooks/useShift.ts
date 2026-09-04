import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftApi } from '../api/misc.api'
import { qk } from './queryKeys'

export const useShift = (enabled = true) => useQuery({ queryKey: qk.shift, queryFn: shiftApi.current, enabled })

export function useOpenShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (openingFloat?: number) => shiftApi.open(openingFloat ?? 0),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shift }),
  })
}
export function useBlindCount() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (v: { id: string; countedCash: number }) => shiftApi.blindCount(v.id, v.countedCash), onSuccess: () => qc.invalidateQueries({ queryKey: qk.shift }) })
}
export function useForceCloseShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; countedCash: number; reason: string }) =>
      shiftApi.forceClose(v.id, { countedCash: v.countedCash, reason: v.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shift })
      qc.invalidateQueries({ queryKey: qk.manager.shifts })
    },
  })
}

export function useResolveShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; note: string }) => shiftApi.resolve(v.id, v.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shift })
      qc.invalidateQueries({ queryKey: qk.manager.shifts })
    },
  })
}
