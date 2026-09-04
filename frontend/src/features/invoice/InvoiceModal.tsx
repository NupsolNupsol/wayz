import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Printer } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button, Spinner } from '@/components/ui'
import { useInvoice } from '@/hooks'
import { bookingApi } from '@/api/booking.api'
import { trackingUrl } from '@/api/public.api'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { InvoiceSlip } from './InvoiceSlip'
import { renderInvoicePdf } from './renderInvoicePdf'

export function InvoiceModal({
  bookingId,
  trackingToken,
  open,
  onClose,
}: {
  bookingId: string
  trackingToken?: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation(['bookings', 'common'])
  const { data: invoice, isLoading } = useInvoice(bookingId, open)
  const [sending, setSending] = useState(false)

  const sendToWhatsApp = async () => {
    if (!invoice) return
    setSending(true)
    try {
      const pdfBase64 = await renderInvoicePdf(invoice, trackingToken ? trackingUrl(trackingToken) : undefined)
      const result = await bookingApi.whatsappInvoice(bookingId, pdfBase64)
      if (result.sent && !result.asText) {
        toast('success', t('invoice.whatsappSent'), t('invoice.whatsappSentDetail', { phone: invoice.customer.phone }))
      } else if (result.sent) {
        toast('warning', t('invoice.whatsappTextOnly'), result.reason ?? '')
      } else {
        toast('danger', t('invoice.whatsappNotSent'), result.reason ?? '')
      }
    } catch (e) {
      toast('danger', t('invoice.whatsappFailed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('invoice.modalTitle')}
      subtitle={t('invoice.modalSubtitle')}
      size="md"
      testId="invoice-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:action.close')}</Button>
          <Button
            variant="secondary"
            onClick={() => void sendToWhatsApp()}
            loading={sending}
            disabled={!invoice || !invoice.customer.phone}
            className="no-print"
            data-testid="invoice-whatsapp"
          >
            <MessageCircle size={15} /> {t('invoice.sendWhatsApp')}
          </Button>
          <Button onClick={() => window.print()} disabled={!invoice} className="no-print" data-testid="invoice-print">
            <Printer size={15} /> {t('invoice.print')}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Spinner />
      ) : invoice ? (
        <>
          <InvoiceSlip invoice={invoice} trackingUrl={trackingToken ? trackingUrl(trackingToken) : undefined} />
          <p className="text-xs text-muted mt-3 text-center no-print" data-testid="invoice-print-note">
            {t('invoice.thermalNote')}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">{t('invoice.notFound')}</p>
      )}
    </Modal>
  )
}
