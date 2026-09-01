import { useQuery } from '@tanstack/react-query'
import { accountingApi, type PeriodFilter } from '../api/accounting.api'
import { qk } from './queryKeys'

export function useAccountingSummary(filter: PeriodFilter) {
  return useQuery({
    queryKey: qk.accounting.summary(filter),
    queryFn: () => accountingApi.summary(filter),
    placeholderData: (previous) => previous,
  })
}

export function useVatReturn(filter: PeriodFilter) {
  return useQuery({
    queryKey: qk.accounting.vatReturn(filter),
    queryFn: () => accountingApi.vatReturn(filter),
    placeholderData: (previous) => previous,
  })
}

export function useAccountingLedger(filter: PeriodFilter) {
  return useQuery({
    queryKey: qk.accounting.ledger(filter),
    queryFn: () => accountingApi.ledger(filter),
    placeholderData: (previous) => previous,
  })
}

export function useZakatReturn(filter: PeriodFilter) {
  return useQuery({
    queryKey: qk.accounting.zakat(filter),
    queryFn: () => accountingApi.zakat(filter),
    placeholderData: (previous) => previous,
  })
}
