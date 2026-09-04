import type { Invoice } from '@/api/invoice.api'

async function qrPng(value: string, size = 260): Promise<string> {
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
      root.render(createElement(QRCodeCanvas, { value, size, level: 'M', bgColor: '#ffffff', fgColor: '#000000' }))
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

export async function renderInvoicePdf(invoice: Invoice, trackingUrl?: string): Promise<string> {
  const [{ pdf }, { InvoiceDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./InvoiceDocument'),
  ])

  const qrDataUri = trackingUrl ? await qrPng(trackingUrl) : undefined
  const blob = await pdf(InvoiceDocument({ data: { invoice, qrDataUri, trackingUrl } })).toBlob()
  const buffer = await blob.arrayBuffer()

  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
