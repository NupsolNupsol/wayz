import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { invoiceApi } from '@/api/invoice.api'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'

/**
 * Downloading a booking's ZATCA invoice.
 *
 * Extracted because two screens need it and they are reached by different people: an agent
 * works from `/bookings/:id`, while anybody in the back office — including the administrator
 * who asked for this — only ever sees a booking through the manager's rental detail. The
 * button was on the first of those and not the second, which read as the feature having
 * disappeared.
 *
 * The file is built in the browser from the XML the API returns, rather than pointing an
 * anchor at the endpoint, because the request carries a bearer token that a plain navigation
 * would not send.
 *
 * Failure is shown, not swallowed. The server refuses by name when a company has not filled in
 * its registration details or its registered address, and that sentence is the whole value of
 * the refusal — "could not generate" on its own would send somebody hunting.
 */
export function useInvoiceXml() {
  const { t } = useTranslation(['bookings', 'common'])
  const [loading, setLoading] = useState(false)

  const download = async (bookingId: string | undefined) => {
    if (!bookingId || loading) return
    setLoading(true)
    try {
      const { xml, filename } = await invoiceApi.xmlForBooking(bookingId)

      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast('success', t('invoice.xmlReady', { defaultValue: 'XML invoice downloaded' }), filename)
    } catch (e) {
      toast(
        'danger',
        t('invoice.xmlFailed', { defaultValue: 'Could not generate XML invoice' }),
        e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : String(e),
      )
    } finally {
      setLoading(false)
    }
  }

  return { download, loading }
}
