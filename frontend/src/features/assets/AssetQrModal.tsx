import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Printer } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui'
import { toast } from '@/state/toastStore'
import { assetUnitUrl } from './assetUrl'

async function downloadPng(svg: SVGSVGElement, fileName: string, caption: string): Promise<void> {
  const size = 900
  const pad = 60
  const captionBand = 130

  const source = new XMLSerializer().serializeToString(svg)
  const image = new Image()
  const svgUrl = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(source)))}`

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('QR image failed to load'))
    image.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = size + pad * 2
  canvas.height = size + pad * 2 + captionBand
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, pad, pad, size, size)

  ctx.fillStyle = '#0f214a'
  ctx.textAlign = 'center'
  ctx.font = 'bold 64px system-ui, sans-serif'
  ctx.fillText(caption, canvas.width / 2, size + pad + 90)

  const png = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = png
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function AssetQrModal({
  open,
  onClose,
  unitId,
  identifier,
  assetTypeName,
  stationName,
}: {
  open: boolean
  onClose: () => void
  unitId: string
  identifier: string
  assetTypeName: string
  stationName: string
}) {
  const { t } = useTranslation(['assets', 'common'])
  const holder = useRef<HTMLDivElement>(null)

  const url = unitId ? assetUnitUrl(unitId) : ''

  const download = async () => {
    const svg = holder.current?.querySelector('svg')
    if (!svg) return
    try {
      await downloadPng(svg, `${identifier || 'asset'}-qr.png`, identifier)
      toast('success', t('qr.downloaded', { identifier }))
    } catch {
      toast('danger', t('qr.couldNotDownload'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('qr.title', { identifier })}
      subtitle={t('qr.subtitle')}
      testId="asset-qr-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:action.close')}</Button>
          <Button variant="secondary" onClick={() => window.print()} className="no-print">
            <Printer size={15} />{t('common:action.print')}</Button>
          <Button onClick={() => void download()} data-testid="asset-qr-download">
            <Download size={15} />{t('common:action.download')}</Button>
        </>
      }
    >
      <div className="receipt-print flex flex-col items-center text-center py-2" ref={holder}>
        <div className="bg-white p-4 rounded-xl border border-line">
          <QRCodeSVG value={url} size={208} level="M" marginSize={2} data-testid="asset-qr-image" />
        </div>
        <p className="mt-3 text-lg font-bold text-navy dark:text-dk-texthi tracking-wide">{identifier}</p>
        <p className="text-sm text-muted">{assetTypeName}{stationName ? ` · ${stationName}` : ''}</p>
        <p className="mt-2 text-[11px] text-muted break-all lf-ltr-nums">{url}</p>
      </div>
    </Modal>
  )
}
