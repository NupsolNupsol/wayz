import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { engineApi, incidentApi } from '../api/misc.api'
import { qk } from './queryKeys'
import type { EngineKind, IncidentType } from '../api/types'

export const useIncidents = () => useQuery({ queryKey: qk.incidents, queryFn: incidentApi.list })


export const useIncidentCatalogue = () => useQuery({ queryKey: qk.incidentTypes, queryFn: engineApi.incidentTypes, staleTime: Infinity })


export function useCreateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: IncidentType; description: string; bookingId?: string; engineKind?: EngineKind }) => incidentApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.incidents }),
  })
}
export function useUpdateIncident() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (v: { id: string; status: string }) => incidentApi.updateStatus(v.id, v.status), onSuccess: () => qc.invalidateQueries({ queryKey: qk.incidents }) })
}

