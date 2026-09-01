import { http, unwrap } from './client'
import type { DashboardStats, EngineKind, EngineWorkflow, Incident, IncidentCatalogue, IncidentType, Shift } from './types'

export const dashboardApi = {
  stats: () => unwrap<DashboardStats>(http.get('/dashboard/stats')),
}

export const engineApi = {
  workflows: () => unwrap<EngineWorkflow[]>(http.get('/engines/workflows')),
  incidentTypes: () => unwrap<IncidentCatalogue>(http.get('/engines/incident-types')),
}

export const shiftApi = {
  current: () => unwrap<Shift | null>(http.get('/shift/current')),
  open: () => unwrap<Shift>(http.post('/shift/open')),
  blindCount: (id: string, countedCash: number) => unwrap<Shift>(http.post(`/shift/${id}/blind-count`, { countedCash })),
  resolve: (id: string, note: string) => unwrap<Shift>(http.post(`/shift/${id}/resolve`, { note })),
}

export const incidentApi = {
  list: () => unwrap<Incident[]>(http.get('/incidents')),
  create: (data: { type: IncidentType; description: string; bookingId?: string; engineKind?: EngineKind }) =>
    unwrap<Incident>(http.post('/incidents', data)),
  updateStatus: (id: string, status: string) => unwrap<Incident>(http.patch(`/incidents/${id}`, { status })),
}
