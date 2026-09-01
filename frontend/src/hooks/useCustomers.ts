import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerApi } from '../api/customer.api'
import { qk } from './queryKeys'

export const useCustomers = (q?: string) => useQuery({ queryKey: qk.customers(q), queryFn: () => customerApi.list(q) })
export const useCustomer = (id: string | undefined) => useQuery({ queryKey: qk.customer(id ?? ''), queryFn: () => customerApi.get(id!), enabled: !!id })


export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (data: { name: string; phone: string; email?: string }) => customerApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }) })
}
