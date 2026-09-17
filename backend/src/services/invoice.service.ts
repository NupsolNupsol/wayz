import { AssetUnit, Gate, InvoiceDoc, Kiosk, Order, Payment, Receipt, Station, Tenant, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { SCHEME_LABELS } from '../constants/labels.constants.js'
import { invoiceWhatsApp } from '../constants/messages.constants.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { PaymentMethod } from '../domain/types.js'
import type { CardScheme } from '../domain/commission.js'
import { env } from '../config/env.js'
import { isPubliclyFetchable, sendFile, sendTextVia, isChannelConfigured } from './vonage.service.js'
import type { Scope } from '../interfaces/index.js'

export type InvoiceLineKind = 'ITEM' | 'PENALTY' | 'OVERTIME' | 'DELIVERY' | 'DEPOSIT'

export interface InvoiceLine {
  index: number
  name: string
  /** The slip prints in Arabic whatever the agent's screen language is. */
  nameAr: string
  quantity: number
  /** The quantity as the customer was charged it — "1h" for an hour, "2" for two items. */
  quantityLabel: string
  unitPrice: number
  total: number
  isDeposit: boolean
  kind: InvoiceLineKind
}

export interface InvoicePaymentLine {
  label: { en: string; ar: string }
  method: PaymentMethod
  amount: number
}

export interface Invoice {
  number: string
  issuedAt: string
  seller: {
    name: string
    legalName: string
    crNumber: string
    vatNumber: string
    currency: string
  }
  branch: string
  desk: string | null
  /** The gate the customer collects from, when that differs from the desk. */
  gate: string | null
  /** The window the customer is charged for. `startedAt` is null until the session begins. */
  session: { startedAt: string | null; endsAt: string | null }
  servedBy: string
  customer: { name: string; phone: string }
  lines: InvoiceLine[]
  payments: InvoicePaymentLine[]
  totals: { base: number; vat: number; vatRate: number; total: number; deposit: number }
  qrPayload: string
  barcode: string
  status: string
}

/** The name of the place a booking is collected from and returned to, if there is one. */
async function handoverPoint(tenantId: string, booking: { gateId?: string | null; session?: { assetUnitId?: string | null } }) {
  if (booking.gateId) {
    return (await Gate.findOne({ _id: booking.gateId, tenantId }, { name: 1 }).lean())?.name ?? null
  }

  const unitId = booking.session?.assetUnitId
  if (!unitId) return null

  const unit = await AssetUnit.findOne({ _id: unitId, tenantId }, { gateId: 1, kioskId: 1 }).lean()
  if (unit?.gateId) return (await Gate.findOne({ _id: unit.gateId, tenantId }, { name: 1 }).lean())?.name ?? null
  if (unit?.kioskId) return (await Kiosk.findOne({ _id: unit.kioskId, tenantId }, { name: 1 }).lean())?.name ?? null
  return null
}

const EXTRA_LINES: Record<string, InvoiceLineKind> = {
  OVERTIME_PENALTY: 'OVERTIME',
  WRONG_STATION_PENALTY: 'PENALTY',
  DELIVERY_FEE: 'DELIVERY',
}

function lineKind(line: { productId: string; isDeposit: boolean }): InvoiceLineKind {
  if (line.isDeposit) return 'DEPOSIT'
  return EXTRA_LINES[line.productId] ?? 'ITEM'
}

const CASH_LABEL = { en: 'Cash', ar: 'نقدًا' }
const CARD_LABEL = { en: 'Card', ar: 'بطاقة' }

function paymentLabel(method: PaymentMethod, cardScheme: CardScheme | null): { en: string; ar: string } {
  if (method === 'CASH') return CASH_LABEL
  return cardScheme ? (SCHEME_LABELS[cardScheme] ?? CARD_LABEL) : CARD_LABEL
}

export async function buildInvoice(scope: Scope, booking: BookingHydrated): Promise<Invoice> {
  const order = await Order.findById(booking.orderId).lean()
  if (!order) throw ApiError.notFound('Order not found.')

  const [tenant, station, kiosk, gate, agent, payments, receipt] = await Promise.all([
    Tenant.findById(scope.tenantId).lean(),
    Station.findOne({ _id: booking.stationId, tenantId: scope.tenantId }).lean(),
    booking.kioskId ? Kiosk.findOne({ _id: booking.kioskId, tenantId: scope.tenantId }).lean() : null,
    /*
     * Where the customer collects and returns it.
     *
     * A bag's booking names its gate. A rented scooter's does not — it is handed over wherever
     * that scooter is parked — so the rented unit's own gate or bay answers instead. Without
     * this the line only ever printed for bag storage, which is the one case the customer
     * already knows where to go.
     */
    handoverPoint(scope.tenantId, booking),
    User.findById(booking.agentId, { fullName: 1 }).lean(),
    Payment.find({ orderId: order._id, tenantId: scope.tenantId, status: { $ne: 'PENDING' } })
      .sort({ createdAt: 1 })
      .lean(),
    Receipt.findOne({ orderId: order._id, tenantId: scope.tenantId }).lean(),
  ])
  if (!tenant) throw ApiError.notFound('Tenant not found.')

  /*
   * A tax invoice has to name who is issuing it.
   *
   * The registration details are not demanded when a company is created — it is set up before
   * its paperwork exists — so this is the moment they become compulsory. Refusing here, by
   * name, is far better than printing an invoice with a blank VAT number that nobody notices
   * until an auditor does.
   */
  const missing = [
    !tenant.legalName?.trim() && 'the registered legal name',
    !tenant.crNumber?.trim() && 'the commercial registration number',
    !tenant.vatNumber?.trim() && 'the VAT number',
  ].filter(Boolean) as string[]

  if (missing.length > 0) {
    throw ApiError.unprocessable(`This company cannot issue a tax invoice yet — it is missing ${missing.join(', ')}.`, [
      'An administrator can add them under Company details.',
    ])
  }

  const byLabel = new Map<string, InvoicePaymentLine>()
  for (const p of payments) {
    const label = paymentLabel(p.method, p.cardScheme)
    const line = byLabel.get(label.en) ?? { label, method: p.method, amount: 0 }
    line.amount = round2(line.amount + (p.kind === 'REFUND' ? -p.amount : p.amount))
    byLabel.set(label.en, line)
  }

  /*
   * How a line's quantity reads on the slip.
   *
   * A bare "1" against a scooter rented for an hour tells the customer nothing — they were
   * charged for time, and the slip should say how much. An hourly line prints "1h"; anything
   * sold by the item keeps its plain count.
   */
  /*
   * A session always has a window; a duration of zero means nothing was booked for time.
   * Every session kind the platform has is timed, so the duration itself is the test.
   */
  const bookedMinutes = booking.session?.requestedDurationMin ?? 0
  const soldByTime = bookedMinutes > 0

  const quantityLabel = (line: (typeof order.lines)[number], kind: InvoiceLineKind): string => {
    /*
     * Only the thing that was rented reads as time. A penalty, a delivery fee or a deposit on
     * the same slip is a count, and labelling those "1h" would be nonsense.
     */
    if (!soldByTime || kind !== 'ITEM' || line.isDeposit) return String(line.quantity)

    const total = bookedMinutes * line.quantity
    const hours = Math.floor(total / 60)
    const minutes = total % 60
    if (hours && minutes) return `${hours}h ${minutes}m`
    if (hours) return `${hours}h`
    return `${minutes}m`
  }

  const lines: InvoiceLine[] = order.lines.map((line, i) => ({
    index: i + 1,
    name: line.name,
    nameAr: line.nameAr || line.name,
    quantity: line.quantity,
    quantityLabel: quantityLabel(line, lineKind(line)),
    unitPrice: round2(line.unitPrice),
    total: round2(line.unitPrice * line.quantity),
    isDeposit: line.isDeposit,
    kind: lineKind(line),
  }))

  return {
    number: order.ref,
    issuedAt: (order.createdAt ?? new Date()).toISOString(),
    seller: {
      name: tenant.name,
      legalName: tenant.legalName,
      crNumber: tenant.crNumber,
      vatNumber: tenant.vatNumber,
      currency: tenant.currency ?? 'SAR',
    },
    branch: station?.name ?? booking.stationId,
    desk: kiosk?.name ?? null,
    /* Where it is handed back, when that is somewhere other than the desk it was sold at. */
    gate: gate ?? null,
    /*
     * When the session runs from and to.
     *
     * The customer is charged for a window and the slip did not name it, so nobody could tell
     * from the paper when their hour ended. `startedAt` is null until the session begins —
     * a bag dropped but not yet started has an end and no beginning, which is honest.
     */
    session: {
      startedAt: booking.session?.startedAt ? new Date(booking.session.startedAt).toISOString() : null,
      endsAt: booking.session?.expectedEndAt ? new Date(booking.session.expectedEndAt).toISOString() : null,
    },
    servedBy: agent?.fullName ?? booking.agentId,
    customer: { name: booking.customerName, phone: booking.customerPhone },
    lines,
    payments: [...byLabel.values()].filter((p) => p.amount !== 0),
    totals: {
      base: round2(order.subtotal),
      vat: round2(order.vat),
      vatRate: booking.vatRate ?? tenant.vatRate ?? 0,
      total: round2(order.total),
      deposit: round2(order.depositTotal ?? 0),
    },
    qrPayload: receipt?.qrPayload ?? `ZATCA|${tenant._id.toUpperCase()}|${order.ref}|${order.total.toFixed(2)}`,
    barcode: order.ref,
    status: order.status,
  }
}

const INVOICE_TTL_MIN = 60

export async function whatsAppInvoice(
  scope: Scope,
  booking: BookingHydrated,
  pdf: Buffer,
): Promise<{ sent: boolean; asText: boolean; url: string; reason?: string }> {
  const [order, tenant] = await Promise.all([
    Order.findById(booking.orderId, { ref: 1, total: 1 }).lean(),
    Tenant.findById(scope.tenantId, { name: 1, currency: 1 }).lean(),
  ])

  if (!booking.customerPhone) {
    return { sent: false, asText: false, url: '', reason: 'This booking has no customer phone number.' }
  }

  const doc = await InvoiceDoc.create({
    tenantId: scope.tenantId,
    bookingId: booking._id,
    orderRef: order?.ref ?? booking.ref,
    pdf,
    expiresAt: new Date(Date.now() + INVOICE_TTL_MIN * 60_000),
  })

  const base = (env.PUBLIC_API_URL ?? env.PUBLIC_APP_URL).replace(/\/$/, '')
  const url = `${base}/api/public/invoice/${doc._id}`
  const tracking = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/track/${booking.trackingToken}`
  const brand = tenant?.name ?? 'WAYZ'

  const message = {
    brand,
    invoiceRef: order?.ref ?? booking.ref,
    total: order?.total ?? 0,
    currency: tenant?.currency ?? 'SAR',
    tracking,
  }
  const thanks = invoiceWhatsApp(message)

  if (!isPubliclyFetchable(url)) {
    const withLink = invoiceWhatsApp({ ...message, invoiceUrl: url })
    const fallback = await sendTextVia(['whatsapp', 'sms'], booking.customerPhone, withLink)
    return {
      sent: fallback.ok,
      asText: true,
      url,
      reason: fallback.ok
        ? `The message went, but not the PDF: WhatsApp fetches attachments itself and cannot reach ${base}. Point PUBLIC_API_URL at a publicly reachable address to attach the invoice.`
        : fallback.error,
    }
  }

  /*
   * WhatsApp carries the PDF itself; SMS carries the link to it.
   *
   * If WhatsApp is not configured at all, the invoice still reaches the customer over SMS
   * as a link rather than not reaching them.
   */
  if (!isChannelConfigured('whatsapp')) {
    const asLink = await sendTextVia(['sms'], booking.customerPhone, invoiceWhatsApp({ ...message, invoiceUrl: url }))
    return { sent: asLink.ok, asText: true, url, reason: asLink.ok ? undefined : asLink.error }
  }

  const result = await sendFile('whatsapp', booking.customerPhone, { url, caption: thanks })
  return { sent: result.ok, asText: false, url, reason: result.ok ? undefined : result.error }
}

export async function readInvoicePdf(token: string): Promise<{ pdf: Buffer; filename: string } | null> {
  const doc = await InvoiceDoc.findById(token)
  if (!doc) return null
  if (doc.expiresAt.getTime() < Date.now()) return null
  return { pdf: Buffer.from(doc.pdf), filename: `invoice-${doc.orderRef}.pdf` }
}
