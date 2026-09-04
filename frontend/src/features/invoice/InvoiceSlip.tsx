import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { Barcode } from '@/components/Barcode'
import type { Invoice } from '@/api/invoice.api'

export function InvoiceSlip({ invoice, trackingUrl }: { invoice: Invoice; trackingUrl?: string }) {
  const { t, i18n } = useTranslation(['bookings', 'common'])
  const ar = i18n.language.startsWith('ar')
  const currency = t('common:money.currency')
  const money = (n: number) => `${n.toFixed(2)} ${currency}`
  const label = (pair: { en: string; ar: string }) => (ar ? pair.ar : pair.en)

  return (
    <div
      className="receipt-print mx-auto w-full max-w-[360px] bg-white text-black p-4 font-sans text-[13px] leading-snug"
      data-testid="invoice-document"
    >
      <header className="text-center border-b border-dashed border-black/40 pb-3">
        <p className="font-bold text-[15px]">{invoice.seller.legalName}</p>
        <p className="text-[12px]">{invoice.seller.name}</p>
        <p className="text-[11px] mt-1">
          {t('invoice.cr')}: <span dir="ltr">{invoice.seller.crNumber}</span>
        </p>
        <p className="text-[11px]">
          {t('invoice.vat')}: <span dir="ltr">{invoice.seller.vatNumber}</span>
        </p>
        <p className="font-bold mt-2">{t('invoice.title')}</p>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-3 border-b border-dashed border-black/40 text-[12px]">
        <dt className="text-black/60">{t('invoice.number')}</dt>
        <dd className="text-end font-semibold" dir="ltr" data-testid="invoice-number">{invoice.number}</dd>

        <dt className="text-black/60">{t('invoice.date')}</dt>
        <dd className="text-end" dir="ltr">{invoice.issuedAt.slice(0, 10)}</dd>

        <dt className="text-black/60">{t('invoice.branch')}</dt>
        <dd className="text-end">{invoice.branch}</dd>

        {invoice.desk && (
          <>
            <dt className="text-black/60">{t('invoice.desk')}</dt>
            <dd className="text-end">{invoice.desk}</dd>
          </>
        )}

        <dt className="text-black/60">{t('invoice.servedBy')}</dt>
        <dd className="text-end" data-testid="invoice-served-by">{invoice.servedBy}</dd>

        <dt className="text-black/60">{t('invoice.customerName')}</dt>
        <dd className="text-end">{invoice.customer.name || '—'}</dd>

        <dt className="text-black/60">{t('invoice.customerPhone')}</dt>
        <dd className="text-end" dir="ltr">{invoice.customer.phone || '—'}</dd>
      </dl>

      <section className="py-3 border-b border-dashed border-black/40">
        <p className="font-bold mb-1.5">{t('invoice.items')}</p>
        <table className="w-full text-[12px]" data-testid="invoice-lines">
          <thead>
            <tr className="border-b border-black/20">
              <th className="text-start font-medium w-6">{t('invoice.no')}</th>
              <th className="text-start font-medium">{t('invoice.item')}</th>
              <th className="text-end font-medium w-10">{t('invoice.qty')}</th>
              <th className="text-end font-medium w-16">{t('invoice.price')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.index} className="align-top">
                <td className="py-1 tabular-nums">{line.index}</td>
                <td className="py-1">
                  {line.name}
                  {line.isDeposit && <span className="text-[10px] text-black/60"> · {t('invoice.deposit')}</span>}
                  {(line.kind === 'PENALTY' || line.kind === 'OVERTIME') && (
                    <span className="ms-1 text-[10px] font-bold border border-black/50 rounded px-1 py-px" data-testid={`invoice-penalty-${line.index}`}>
                      {t(line.kind === 'OVERTIME' ? 'invoice.overtimeTag' : 'invoice.penaltyTag')}
                    </span>
                  )}
                  {line.kind === 'DELIVERY' && (
                    <span className="text-[10px] text-black/60"> · {t('invoice.deliveryTag')}</span>
                  )}
                </td>
                <td className="py-1 text-end tabular-nums">{line.quantity}</td>
                <td className="py-1 text-end tabular-nums" dir="ltr">{line.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="py-3 border-b border-dashed border-black/40">
        <p className="font-bold mb-1.5">{t('invoice.paymentMethods')}</p>
        {invoice.payments.length === 0 ? (
          <p className="text-[12px] text-black/60">{t('invoice.notPaidYet')}</p>
        ) : (
          <ul className="text-[12px]" data-testid="invoice-payments">
            {invoice.payments.map((p) => (
              <li key={p.label.en} className="flex justify-between py-0.5">
                <span>{label(p.label)}</span>
                <span className="tabular-nums" dir="ltr">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="py-3 text-[12px]">
        <div className="flex justify-between py-0.5">
          <span>{t('invoice.beforeVat')}</span>
          <span className="tabular-nums" dir="ltr">{money(invoice.totals.base)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>{t('invoice.vatLine', { percent: Math.round(invoice.totals.vatRate * 100) })}</span>
          <span className="tabular-nums" dir="ltr">{money(invoice.totals.vat)}</span>
        </div>
        {invoice.totals.deposit > 0 && (
          <div className="flex justify-between py-0.5">
            <span>{t('invoice.depositHeld')}</span>
            <span className="tabular-nums" dir="ltr">{money(invoice.totals.deposit)}</span>
          </div>
        )}
        <div className="flex justify-between py-1 mt-1 border-t border-black/40 font-bold text-[14px]">
          <span>{t('invoice.total')}</span>
          <span className="tabular-nums" dir="ltr" data-testid="invoice-total">{money(invoice.totals.total)}</span>
        </div>
      </section>

      <footer className="text-center pt-2 border-t border-dashed border-black/40">
        {trackingUrl && (
          <div className="flex flex-col items-center pt-1 pb-2">
            <QRCodeSVG value={trackingUrl} size={104} level="M" bgColor="#ffffff" fgColor="#000000" />
            <p className="text-[11px] mt-1">{t('invoice.scanToTrack')}</p>
          </div>
        )}
        <div className="flex justify-center py-2">
          <Barcode value={invoice.barcode} height={44} />
        </div>
        <p className="text-[12px]">{t('invoice.thankYou')}</p>
        <p className="text-[10px] text-black/60 mt-1">{t('invoice.terms')}</p>
      </footer>
    </div>
  )
}
