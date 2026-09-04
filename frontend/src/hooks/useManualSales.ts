import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { manualSaleApi, type ManualSaleStatus } from '../api/manualSale.api'
import { qk } from './queryKeys'

export function useManualSales(params?: { status?: ManualSaleStatus; from?: string; to?: string }) {
  return useQuery({ queryKey: qk.manualSales(params ?? {}), queryFn: () => manualSaleApi.list(params) })
}

function useInvalidateManualSales() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['manual-sales'] })
}

export function useRecordManualSale() {
  const invalidate = useInvalidateManualSales()
  return useMutation({ mutationFn: manualSaleApi.create, onSuccess: invalidate })
}

export function useReviewManualSale() {
  const invalidate = useInvalidateManualSales()
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean; note?: string }) =>
      manualSaleApi.review(v.id, { approve: v.approve, note: v.note }),
    onSuccess: invalidate,
  })
}
