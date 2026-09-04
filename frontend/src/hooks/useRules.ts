import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rulesApi } from '../api/rules.api'
import { qk } from './queryKeys'

export function useTenantRules() {
  return useQuery({ queryKey: qk.admin.rules, queryFn: rulesApi.read })
}

export function useUpdateRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rulesApi.update,
    onSuccess: (next) => qc.setQueryData(qk.admin.rules, next),
  })
}
