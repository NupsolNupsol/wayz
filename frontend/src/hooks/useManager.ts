import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { managerApi } from '../api/manager.api'
import { qk } from './queryKeys'

export const useManagerOverview = () =>
  useQuery({ queryKey: qk.manager.overview, queryFn: managerApi.overview, refetchInterval: 30_000 })
export const useManagerLiveSessions = () =>
  useQuery({ queryKey: qk.manager.live, queryFn: managerApi.liveSessions, refetchInterval: 20_000 })
export const useManagerIncidents = () => useQuery({ queryKey: qk.manager.incidents, queryFn: managerApi.incidents })
export const useManagerShifts = () => useQuery({ queryKey: qk.manager.shifts, queryFn: managerApi.shifts })
export const useManagerStaff = () => useQuery({ queryKey: qk.manager.staff, queryFn: managerApi.staff })

export const useManagerRentals = (scope: 'active' | 'completed' | 'expired' | 'all') =>
  useQuery({ queryKey: qk.manager.rentals(scope), queryFn: () => managerApi.rentals(scope) })
export const useManagerRental = (id: string | undefined) =>
  useQuery({ queryKey: qk.manager.rental(id ?? ''), queryFn: () => managerApi.rentalDetail(id!), enabled: !!id })
export const useManagerCustomers = () => useQuery({ queryKey: qk.manager.customers, queryFn: managerApi.customers })
export const useManagerCustomer = (id: string | undefined) =>
  useQuery({ queryKey: qk.manager.customer(id ?? ''), queryFn: () => managerApi.customerDetail(id!), enabled: !!id })
export const useManagerOrg = () => useQuery({ queryKey: qk.manager.org, queryFn: managerApi.org })
export const useManagerPayments = () => useQuery({ queryKey: qk.manager.payments, queryFn: managerApi.payments })
export const useManagerPricing = () => useQuery({ queryKey: qk.manager.pricing, queryFn: managerApi.pricing })
export const useManagerSettings = () => useQuery({ queryKey: qk.manager.settings, queryFn: managerApi.settings })
export const useManagerActivity = () => useQuery({ queryKey: qk.manager.activity, queryFn: managerApi.activity })
export const useReportRevenue = (r: { from?: string; to?: string }) =>
  useQuery({ queryKey: qk.manager.reportRevenue(r), queryFn: () => managerApi.reportRevenue(r) })
export const useReportOccupancy = () => useQuery({ queryKey: qk.manager.reportOccupancy, queryFn: managerApi.reportOccupancy })
export const useReportRentals = (r: { from?: string; to?: string }) =>
  useQuery({ queryKey: qk.manager.reportRentals(r), queryFn: () => managerApi.reportRentals(r) })

function useOrgMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: qk.manager.org })
      qc.invalidateQueries({ queryKey: qk.manager.overview })
    },
  })
}

export const useCreateSite = () => useOrgMutation((v: Record<string, unknown>) => managerApi.createSite(v))
export const useUpdateSite = () => useOrgMutation((v: { id: string; patch: Record<string, unknown> }) => managerApi.updateSite(v.id, v.patch))
export const useCreateStation = () => useOrgMutation((v: Record<string, unknown>) => managerApi.createStation(v))
export const useUpdateStation = () => useOrgMutation((v: { id: string; patch: Record<string, unknown> }) => managerApi.updateStation(v.id, v.patch))
export const useCreateKiosk = () => useOrgMutation((v: Record<string, unknown>) => managerApi.createKiosk(v))
export const useUpdateKiosk = () => useOrgMutation((v: { id: string; patch: Record<string, unknown> }) => managerApi.updateKiosk(v.id, v.patch))

function useStaffMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.manager.staff })
      qc.invalidateQueries({ queryKey: qk.manager.overview })
    },
  })
}
export const useCreateStaff = () => useStaffMutation((v: Record<string, unknown>) => managerApi.createStaff(v))
export const useUpdateStaff = () => useStaffMutation((v: { id: string; patch: Record<string, unknown> }) => managerApi.updateStaff(v.id, v.patch))
export const useResetStaffPassword = () => useStaffMutation((v: { id: string; password: string }) => managerApi.resetPassword(v.id, v.password))
export const useReinviteStaff = () => useStaffMutation((id: string) => managerApi.reinvite(id))

function usePricingMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.manager.pricing })
      qc.invalidateQueries({ queryKey: qk.products() })
    },
  })
}
export const useCreateProduct = () => usePricingMutation((v: Record<string, unknown>) => managerApi.createProduct(v))
export const useUpdateProduct = () => usePricingMutation((v: { id: string; patch: Record<string, unknown> }) => managerApi.updateProduct(v.id, v.patch))

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: Record<string, unknown>) => managerApi.updateSettings(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.manager.settings }),
  })
}

export function useManagerUpdateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; status: string }) => managerApi.updateIncident(v.id, v.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.manager.incidents })
      qc.invalidateQueries({ queryKey: qk.manager.overview })
    },
  })
}
