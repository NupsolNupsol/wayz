import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/admin.api'
import { qk } from './queryKeys'

export function useTenantOverview(enabled = true) {
  return useQuery({ queryKey: qk.admin.overview, queryFn: adminApi.overview, enabled, refetchInterval: 30_000 })
}

export function useTenantPeople(enabled = true) {
  return useQuery({ queryKey: qk.admin.people, queryFn: adminApi.people, enabled })
}

export function useTenantAudit(enabled = true) {
  return useQuery({ queryKey: qk.admin.audit, queryFn: adminApi.audit, enabled })
}

export function useTenantIsolation(enabled = true) {
  return useQuery({ queryKey: qk.admin.isolation, queryFn: adminApi.isolation, enabled })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.updateCompany,
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: qk.admin.overview })
      qc.invalidateQueries({ queryKey: qk.manager.settings })
      qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}
