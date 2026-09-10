import { createPortal } from 'react-dom'
import { InvoiceSlip } from './InvoiceSlip'
import type { Invoice } from '@/api/invoice.api'

/**
 * The copy that goes to the printer.
 *
 * A slip shown inside a dialog cannot be printed as-is: the dialog is portalled to the body so it
 * survives the rule that hides the app, and its own header, padding and buttons go to the paper
 * with it — a title, a Close button, and a slip nudged far enough sideways that the edge falls off
 * an 80mm roll.
 *
 * So the printer gets its own copy, mounted straight on the body with nothing around it. On screen
 * it is parked off-canvas; in print it is the only thing left standing.
 */
export function PrintableSlip({ invoice, trackingUrl }: { invoice: Invoice; trackingUrl?: string }) {
  return createPortal(
    <div className="print-only" data-testid="printable-slip">
      <InvoiceSlip invoice={invoice} trackingUrl={trackingUrl} />
    </div>,
    document.body,
  )
}
