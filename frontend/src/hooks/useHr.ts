import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hrApi, type ExpenseInput, type HrFilter } from '../api/hr.api'
import { qk } from './queryKeys'

export function useHrOverview(filter: HrFilter = {}) {
  return useQuery({
    queryKey: qk.hr.overview(filter),
    queryFn: () => hrApi.overview(filter),
    placeholderData: (previous) => previous,
  })
}

export function useHrExpenses(filter: HrFilter = {}) {
  return useQuery({
    queryKey: qk.hr.expenses(filter),
    queryFn: () => hrApi.expenses(filter),
    placeholderData: (previous) => previous,
  })
}

export function useHrSeasons() {
  return useQuery({ queryKey: qk.hr.seasons, queryFn: hrApi.seasons })
}

export function useSeason(id: string) {
  return useQuery({ queryKey: qk.hr.season(id), queryFn: () => hrApi.season(id), enabled: !!id })
}

function useHrRefresh() {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['hr'] }),
      qc.refetchQueries({ queryKey: ['accounting'] }),
    ])
  }
}

export function useCreateExpense() {
  const refresh = useHrRefresh()
  return useMutation({ mutationFn: (input: ExpenseInput) => hrApi.createExpense(input), onSuccess: refresh })
}

export function useVoidExpense() {
  const refresh = useHrRefresh()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => hrApi.voidExpense(id, reason),
    onSuccess: refresh,
  })
}

export function useCreateSeason() {
  const refresh = useHrRefresh()
  return useMutation({
    mutationFn: (input: { name: string; startsAt: string; endsAt: string }) => hrApi.createSeason(input),
    onSuccess: refresh,
  })
}

export function useChargePayroll() {
  const refresh = useHrRefresh()
  return useMutation({ mutationFn: hrApi.chargePayroll, onSuccess: refresh })
}
