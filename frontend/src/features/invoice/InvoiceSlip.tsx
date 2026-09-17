import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Barcode } from '@/components/Barcode';
import type { Invoice } from '@/api/invoice.api';

/**
 * The ZATCA QR payload: tag-length-value, base64.
 *
 * Phase-one e-invoicing requires a QR on the printed slip carrying five fields in exactly this
 * order, each as `[tag byte][length byte][UTF-8 value]`, the whole run base64-encoded. The
 * length is a byte *count*, not a character count, which is why the value is encoded first —
 * an Arabic seller name is two or three bytes per character and a character count would put
 * every following field at the wrong offset.
 */
function encodeTLV(fields: Array<[number, string]>): string {
  const bytes: number[] = [];

  for (const [tag, value] of fields) {
    const valueBytes = new TextEncoder().encode(value);

    if (tag < 0 || tag > 255) {
      throw new Error(`Invalid TLV tag: ${tag}`);
    }

    if (valueBytes.length > 255) {
      throw new Error(`TLV value for tag ${tag} exceeds 255 bytes`);
    }

    // Tag: 1 byte
    bytes.push(tag);

    // Length: 1 byte
    bytes.push(valueBytes.length);

    // Value: N bytes
    bytes.push(...valueBytes);
  }

  // Convert bytes -> binary string -> Base64
  const binary = String.fromCharCode(...bytes);

  return btoa(binary);
}

/** The five fields ZATCA wants, in the order it wants them. */
function buildInvoiceQrPayload(invoice: Invoice): string {
  return encodeTLV([
    [1, invoice.seller.name],
    [2, invoice.seller.vatNumber],
    [3, invoice.issuedAt],
    [4, invoice.totals.total.toFixed(2)],
    [5, invoice.totals.vat.toFixed(2)],
  ]);
}

export function InvoiceSlip({ invoice, trackingUrl }: { invoice: Invoice; trackingUrl?: string }) {
  const { i18n } = useTranslation(['bookings', 'common']);
  // The slip is the customer's document, not the agent's screen: it always comes out of the
  // printer in Arabic, whichever language the agent happens to be working in.
  const t = i18n.getFixedT('ar', ['bookings', 'common']);
  const currency = t('common:money.currency');
  const money = (n: number) => `${n.toFixed(2)} ${currency}`;
  const label = (pair: { en: string; ar: string }) => pair.ar;
  const qrPayload = buildInvoiceQrPayload(invoice);

  /** Date and time of day, in the branch's own reading order. */
  const clock = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  return (
    <div
      dir="rtl"
      lang="ar"
      className="receipt-print mx-auto w-full max-w-[360px] bg-white text-black p-4 font-sans text-[15px] leading-snug"
      data-testid="invoice-document"
    >
      <header className="text-center border-b border-dashed border-black/40 pb-3">
        <p className="font-bold text-[18px]" dir="auto">
          {invoice.seller.legalName}
        </p>
        <p className="text-[14px]" dir="auto">
          {invoice.seller.name}
        </p>
        <p className="text-[13px] mt-1">
          {t('invoice.cr')}: <span dir="ltr">{invoice.seller.crNumber}</span>
        </p>
        <p className="text-[13px]">
          {t('invoice.vat')}: <span dir="ltr">{invoice.seller.vatNumber}</span>
        </p>
        <p className="font-bold mt-2">{t('invoice.title')}</p>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-3 border-b border-dashed border-black/40 text-[14px]">
        <dt className="text-black/60">{t('invoice.number')}</dt>
        <dd className="text-end font-semibold" dir="ltr" data-testid="invoice-number">
          {invoice.number}
        </dd>

        <dt className="text-black/60">{t('invoice.date')}</dt>
        <dd className="text-end" dir="ltr">
          {invoice.issuedAt.slice(0, 10)}
        </dd>

        <dt className="text-black/60">{t('invoice.branch')}</dt>
        <dd className="text-end" dir="auto">
          {invoice.branch}
        </dd>

        {invoice.desk && (
          <>
            <dt className="text-black/60">{t('invoice.desk')}</dt>
            <dd className="text-end" dir="auto">
              {invoice.desk}
            </dd>
          </>
        )}

        {/*
          Where the customer collects, when that is not the desk they bought at.

          A scooter sold at the welcome desk is handed over at a vehicle bay, and the slip did
          not say which — so somebody holding the paper had no way to find their scooter.
        */}
        {invoice.gate && (
          <>
            <dt className="text-black/60">
              {t('invoice.gate', { defaultValue: 'بوابة التسليم' })}
            </dt>
            <dd className="text-end" dir="auto" data-testid="invoice-gate">
              {invoice.gate}
            </dd>
          </>
        )}

        {/*
          The window the customer paid for.

          They are charged for time and the slip named none of it, so there was no way to tell
          from the paper when the hour ran out. Printed as clock times rather than a duration,
          because "until 14:30" is what somebody standing there needs.
        */}
        {invoice.session?.startedAt && (
          <>
            <dt className="text-black/60">
              {t('invoice.startedAt', { defaultValue: 'وقت البداية' })}
            </dt>
            <dd className="text-end" dir="ltr" data-testid="invoice-started-at">
              {clock(invoice.session.startedAt)}
            </dd>
          </>
        )}
        {invoice.session?.endsAt && (
          <>
            <dt className="text-black/60">
              {t('invoice.endsAt', { defaultValue: 'وقت الانتهاء' })}
            </dt>
            <dd className="text-end" dir="ltr" data-testid="invoice-ends-at">
              {clock(invoice.session.endsAt)}
            </dd>
          </>
        )}

        <dt className="text-black/60">{t('invoice.servedBy')}</dt>
        <dd className="text-end" dir="auto" data-testid="invoice-served-by">
          {invoice.servedBy}
        </dd>

        <dt className="text-black/60">{t('invoice.customerName')}</dt>
        <dd className="text-end" dir="auto">
          {invoice.customer.name || '—'}
        </dd>

        <dt className="text-black/60">{t('invoice.customerPhone')}</dt>
        <dd className="text-end" dir="ltr">
          {invoice.customer.phone || '—'}
        </dd>
      </dl>

      <section className="py-3 border-b border-dashed border-black/40">
        <p className="font-bold mb-1.5">{t('invoice.items')}</p>
        <table className="w-full text-[14px]" data-testid="invoice-lines">
          <thead>
            <tr className="border-b border-black/20">
              <th className="text-start font-medium w-6">{t('invoice.no')}</th>
              <th className="text-start font-medium">{t('invoice.item')}</th>
              <th className="text-end font-medium w-12">{t('invoice.qty')}</th>
              <th className="text-end font-medium w-20">{t('invoice.price')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.index} className="align-top">
                <td className="py-1 tabular-nums">{line.index}</td>
                <td className="py-1" dir="auto">
                  {line.nameAr}
                  {line.isDeposit && (
                    <span className="text-[12px] text-black/60"> · {t('invoice.deposit')}</span>
                  )}
                  {(line.kind === 'PENALTY' || line.kind === 'OVERTIME') && (
                    <span
                      className="ms-1 text-[12px] font-bold border border-black/50 rounded px-1 py-px"
                      data-testid={`invoice-penalty-${line.index}`}
                    >
                      {t(line.kind === 'OVERTIME' ? 'invoice.overtimeTag' : 'invoice.penaltyTag')}
                    </span>
                  )}
                  {line.kind === 'DELIVERY' && (
                    <span className="text-[12px] text-black/60"> · {t('invoice.deliveryTag')}</span>
                  )}
                </td>
                {/* "1h" for an hour rented, "2" for two items bought — see quantityLabel. */}
                <td
                  className="py-1 text-end tabular-nums"
                  data-testid={`invoice-qty-${line.index}`}
                >
                  {line.quantityLabel ?? line.quantity}
                </td>
                <td className="py-1 text-end tabular-nums" dir="ltr">
                  {line.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="py-3 border-b border-dashed border-black/40">
        <p className="font-bold mb-1.5">{t('invoice.paymentMethods')}</p>
        {invoice.payments.length === 0 ? (
          <p className="text-[14px] text-black/60">{t('invoice.notPaidYet')}</p>
        ) : (
          <ul className="text-[14px]" data-testid="invoice-payments">
            {invoice.payments.map((p) => (
              <li key={p.label.en} className="flex justify-between py-0.5">
                <span>{label(p.label)}</span>
                <span className="tabular-nums" dir="ltr">
                  {money(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="py-3 text-[14px]">
        <div className="flex justify-between py-0.5">
          <span>{t('invoice.beforeVat')}</span>
          <span className="tabular-nums" dir="ltr">
            {money(invoice.totals.base)}
          </span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>{t('invoice.vatLine', { percent: Math.round(invoice.totals.vatRate * 100) })}</span>
          <span className="tabular-nums" dir="ltr">
            {money(invoice.totals.vat)}
          </span>
        </div>
        {invoice.totals.deposit > 0 && (
          <div className="flex justify-between py-0.5">
            <span>{t('invoice.depositHeld')}</span>
            <span className="tabular-nums" dir="ltr">
              {money(invoice.totals.deposit)}
            </span>
          </div>
        )}
        <div className="flex justify-between py-1 mt-1 border-t border-black/40 font-bold text-[17px]">
          <span>{t('invoice.total')}</span>
          <span className="tabular-nums" dir="ltr" data-testid="invoice-total">
            {money(invoice.totals.total)}
          </span>
        </div>
      </section>

      <footer className="text-center pt-2 border-t border-dashed border-black/40">
        {/*
          Two codes, and they are not interchangeable.

          The left one is the tax authority's: five fields, TLV, base64 — what an inspector
          scans. The right one is the customer's, and points at the tracking page. Printing
          only one of them was the gap.
        */}
        {trackingUrl && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center pt-1 pb-2">
              <QRCodeSVG
                value={qrPayload}
                size={104}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
              <p className="text-[13px] mt-1" data-testid="invoice-zatca-qr">
                ZATCA
              </p>
            </div>
            <div className="flex flex-col items-center pt-1 pb-2">
              <QRCodeSVG
                value={trackingUrl}
                size={104}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
              <p className="text-[13px] mt-1">{t('invoice.scanToTrack')}</p>
            </div>
          </div>
        )}
        <div className="flex justify-center py-2">
          <Barcode value={invoice.barcode} height={44} />
        </div>
        <p className="text-[14px]">{t('invoice.thankYou')}</p>
        <p className="text-[12px] text-black/60 mt-1">{t('invoice.terms')}</p>
      </footer>
    </div>
  );
}
