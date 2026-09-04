import { useQuery } from '@tanstack/react-query'
import { invoiceApi } from '../api/invoice.api'
import { qk } from './queryKeys'

export function useInvoice(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: qk.invoice(bookingId),
    queryFn: () => invoiceApi.forBooking(bookingId),
    enabled: enabled && !!bookingId,
  })
}
