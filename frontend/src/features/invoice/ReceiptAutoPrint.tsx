import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useReceiptStore } from '@/state/receiptStore'
import { useInvoice } from '@/hooks'
import { trackingUrl } from '@/api/public.api'
import { toast } from '@/state/toastStore'
import { InvoiceSlip } from './InvoiceSlip'

/**
 * Mounted once by the app shell so a receipt follows a payment from anywhere in the platform.
 * The slip is rendered off-screen and sent straight to the printer — no dialog to dismiss, so the
 * agent can carry on with the next step of the sale while the paper comes out.
 */
export function ReceiptAutoPrint() {
  const slip = useReceiptStore((s) => s.slip)
  return slip ? <Slip bookingId={slip.bookingId} trackingToken={slip.trackingToken} /> : null
}

function Slip({ bookingId, trackingToken }: { bookingId: string; trackingToken?: string }) {
  const { t } = useTranslation('bookings')
  const clear = useReceiptStore((s) => s.clear)
  const { data: invoice, isError } = useInvoice(bookingId, true)
  const fired = useRef(false)

  useEffect(() => {
    if (isError) clear()
  }, [isError, clear])

  useEffect(() => {
    if (!invoice || fired.current) return
    fired.current = true
    // One frame for the slip to lay out, then the printer, then get out of the way.
    const id = window.setTimeout(() => {
      window.print()
      toast('info', t('invoice.autoPrinted'))
      clear()
    }, 300)
    return () => window.clearTimeout(id)
  }, [invoice, clear, t])

  if (!invoice) return null

  return createPortal(
    <div className="print-only" data-testid="receipt-auto-printed">
      <InvoiceSlip invoice={invoice} trackingUrl={trackingToken ? trackingUrl(trackingToken) : undefined} />
    </div>,
    document.body,
  )
}
