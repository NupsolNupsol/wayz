import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  accountingApi,
  type PaymentLedgerFilter,
  type CardScheme,
  type RawTransaction,
  type TransactionFilter,
  type TransactionSource,
} from '../api/accounting.api'
import { qk } from './queryKeys'

export function useCommissionRates() {
  return useQuery({ queryKey: qk.accounting.commissionRates, queryFn: accountingApi.commissionRates })
}

export function useCardTransactions(filter: TransactionFilter) {
  return useQuery({
    queryKey: qk.accounting.transactions(filter),
    queryFn: () => accountingApi.transactions(filter),
    placeholderData: (previous) => previous,
  })
}

export function useTransactionSummary(filter: TransactionFilter) {
  return useQuery({
    queryKey: qk.accounting.transactionSummary(filter),
    queryFn: () => accountingApi.transactionSummary(filter),
    placeholderData: (previous) => previous,
  })
}

export function useReconciliation(filter: TransactionFilter) {
  return useQuery({
    queryKey: qk.accounting.reconciliation(filter),
    queryFn: () => accountingApi.reconciliation(filter),
    placeholderData: (previous) => previous,
  })
}

function useAccountingRefresh() {
  const qc = useQueryClient()
  return async () => {
    await qc.refetchQueries({ queryKey: ['accounting'] })
  }
}

export function useUpdateCommissionRates() {
  const refresh = useAccountingRefresh()
  return useMutation({
    mutationFn: ({ rates, repriceUnsettled }: { rates: Partial<Record<CardScheme, number>>; repriceUnsettled?: boolean }) =>
      accountingApi.updateCommissionRates(rates, repriceUnsettled ?? false),
    onSuccess: refresh,
  })
}

export function useIngestTransactions() {
  const refresh = useAccountingRefresh()
  return useMutation({
    mutationFn: ({ transactions, source }: { transactions: RawTransaction[]; source?: TransactionSource }) =>
      accountingApi.ingest(transactions, source ?? 'ETL'),
    onSuccess: refresh,
  })
}

export function useCardTransaction(id: string) {
  return useQuery({ queryKey: qk.accounting.transaction(id), queryFn: () => accountingApi.transaction(id), enabled: !!id })
}

export function usePaymentLedger(filter: PaymentLedgerFilter) {
  return useQuery({
    queryKey: qk.accounting.payments(filter),
    queryFn: () => accountingApi.payments(filter),
    placeholderData: (previous) => previous,
  })
}

export function useLedgerPayment(id: string) {
  return useQuery({ queryKey: qk.accounting.payment(id), queryFn: () => accountingApi.payment(id), enabled: !!id })
}
