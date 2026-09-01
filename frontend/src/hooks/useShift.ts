import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftApi } from '../api/misc.api'
import { qk } from './queryKeys'

export const useShift = () => useQuery({ queryKey: qk.shift, queryFn: shiftApi.current })


export function useOpenShift() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => shiftApi.open(), onSuccess: () => qc.invalidateQueries({ queryKey: qk.shift }) })
}
export function useBlindCount() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (v: { id: string; countedCash: number }) => shiftApi.blindCount(v.id, v.countedCash), onSuccess: () => qc.invalidateQueries({ queryKey: qk.shift }) })
}
export function useResolveShift() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (v: { id: string; note: string }) => shiftApi.resolve(v.id, v.note), onSuccess: () => qc.invalidateQueries({ queryKey: qk.shift }) })
}
