import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { versionsApi } from '../api/versions.api'

export function useVersions(enabled = true) {
  return useQuery({ queryKey: ['versions'], queryFn: versionsApi.list, enabled, staleTime: 60_000 })
}

export function useVersion(id: string | undefined) {
  return useQuery({
    queryKey: ['versions', id ?? ''],
    queryFn: () => versionsApi.detail(id!),
    enabled: !!id,
    staleTime: 60_000,
  })
}

function useVersionMutation<V>(fn: (v: V) => Promise<unknown>, id: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['versions', id ?? ''] })
      qc.invalidateQueries({ queryKey: ['versions'] })
    },
  })
}

export function useCheckChange(id: string | undefined) {
  return useVersionMutation((v: { index: number; by: string }) => versionsApi.check(id!, v.index, v.by), id)
}

export function useReportIssue(id: string | undefined) {
  return useVersionMutation(
    (v: { index: number; by: string; note: string }) => versionsApi.report(id!, v.index, v.by, v.note),
    id,
  )
}
