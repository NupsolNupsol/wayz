import { bookingApi } from '@/api/booking.api'
import { invoiceApi } from '@/api/invoice.api'
import { trackingUrl } from '@/api/public.api'
import { toast } from '@/state/toastStore'
import i18n from '@/i18n'
import { renderInvoicePdf } from './renderInvoicePdf'

export async function sendInvoiceOnPayment(bookingId: string, trackingToken?: string): Promise<void> {
  try {
    const invoice = await invoiceApi.forBooking(bookingId)
    if (!invoice.customer.phone) return

    const pdfBase64 = await renderInvoicePdf(invoice, trackingToken ? trackingUrl(trackingToken) : undefined)
    const result = await bookingApi.whatsappInvoice(bookingId, pdfBase64)

    if (result.sent && !result.asText) {
      toast('success', i18n.t('bookings:invoice.whatsappSent'), i18n.t('bookings:invoice.whatsappSentDetail', { phone: invoice.customer.phone }))
    } else if (result.sent) {
      toast('warning', i18n.t('bookings:invoice.whatsappTextOnly'), result.reason ?? '')
    } else if (result.reason) {
      toast('warning', i18n.t('bookings:invoice.whatsappNotSent'), result.reason)
    }
  } catch {
    toast('warning', i18n.t('bookings:invoice.whatsappNotSent'), i18n.t('bookings:invoice.whatsappRetry'))
  }
}
