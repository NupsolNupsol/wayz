import { useState } from 'react'
import { trackingUrl } from '@/api/public.api'
import { useAuthStore } from '@/store/auth'
import { APP } from '@/config/appConfig'
import { toast } from '@/state/toastStore'
import type { Booking, Order } from '@/api/types'

async function qrPngDataUri(value: string, size = 320): Promise<string> {
  const { QRCodeCanvas } = await import('qrcode.react')
  const { createRoot } = await import('react-dom/client')
  const { createElement } = await import('react')

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden'
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    await new Promise<void>((resolve) => {
      root.render(
        createElement(QRCodeCanvas, {
          value,
          size,
          level: 'M',
          bgColor: '#ffffff',
          fgColor: '#0f214a',
          includeMargin: true,
        }),
      )
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    const canvas = host.querySelector('canvas')
    if (!canvas) throw new Error('QR canvas was not rendered.')
    return canvas.toDataURL('image/png')
  } finally {
    root.unmount()
    host.remove()
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useInvoiceDownload() {
  const [generating, setGenerating] = useState(false)
  const me = useAuthStore((s) => s.me)

  const download = async (booking: Booking, order: Order) => {
    setGenerating(true)
    try {
      const url = trackingUrl(booking.trackingToken)
      const [{ pdf }, { InvoiceDocument }, qrDataUri] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./InvoiceDocument'),
        qrPngDataUri(url),
      ])

      const blob = await pdf(
        InvoiceDocument({
          data: {
            booking,
            order,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            brandName: me?.tenant?.name ?? APP.name,
            currency: me?.tenant?.currency ?? APP.currency,
            qrDataUri,
            trackingUrl: url,
            issuedAt: new Date(),
          },
        }),
      ).toBlob()

      triggerDownload(blob, `invoice-${order.ref}.pdf`)
      toast('success', 'Invoice downloaded', `${order.ref}.pdf`)
    } catch (e) {
      toast('danger', 'Could not generate the invoice', e instanceof Error ? e.message : '')
    } finally {
      setGenerating(false)
    }
  }

  return { download, generating }
}
