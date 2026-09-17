import { useQuery } from '@tanstack/react-query'
import { invoiceApi } from '../api/invoice.api'
import { qk } from './queryKeys'

/**
 * A booking's invoice, always as it stands now.
 *
 * An invoice is not fixed at payment. The receipt printed at the till fetches it the moment the
 * money is taken — before the rental has started — and the session's start and end, any
 * overtime and any later payment all arrive afterwards. With the default caching, opening the
 * invoice from the booking page showed that first copy: a slip with no start time, ready to be
 * printed and handed to the customer.
 *
 * So it is never taken from the cache without asking again. `isFresh` is false until this
 * mount's own fetch has landed, and a screen that prints or sends the slip waits for it.
 */
export function useInvoice(bookingId: string, enabled = true) {
  const query = useQuery({
    queryKey: qk.invoice(bookingId),
    queryFn: () => invoiceApi.forBooking(bookingId),
    enabled: enabled && !!bookingId,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  return { ...query, isFresh: query.isFetchedAfterMount && !query.isFetching }
}
