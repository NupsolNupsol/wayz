import { InvoiceDoc, Kiosk, Order, Payment, Receipt, Station, Tenant, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { SCHEME_LABELS } from '../constants/labels.constants.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { PaymentMethod } from '../domain/types.js'
import type { CardScheme } from '../domain/commission.js'
import { env } from '../config/env.js'
import { isPubliclyFetchable, sendWhatsAppFile, sendWhatsAppText } from './whatsapp.service.js'
import type { Scope } from '../interfaces/index.js'

export type InvoiceLineKind = 'ITEM' | 'PENALTY' | 'OVERTIME' | 'DELIVERY' | 'DEPOSIT'

export interface InvoiceLine {
  index: number
  name: string
  quantity: number
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
  servedBy: string
  customer: { name: string; phone: string }
  lines: InvoiceLine[]
  payments: InvoicePaymentLine[]
  totals: { base: number; vat: number; vatRate: number; total: number; deposit: number }
  qrPayload: string
  barcode: string
  status: string
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

  const [tenant, station, kiosk, agent, payments, receipt] = await Promise.all([
    Tenant.findById(scope.tenantId).lean(),
    Station.findOne({ _id: booking.stationId, tenantId: scope.tenantId }).lean(),
    booking.kioskId ? Kiosk.findOne({ _id: booking.kioskId, tenantId: scope.tenantId }).lean() : null,
    User.findById(booking.agentId, { fullName: 1 }).lean(),
    Payment.find({ orderId: order._id, tenantId: scope.tenantId, status: { $ne: 'PENDING' } })
      .sort({ createdAt: 1 })
      .lean(),
    Receipt.findOne({ orderId: order._id, tenantId: scope.tenantId }).lean(),
  ])
  if (!tenant) throw ApiError.notFound('Tenant not found.')

  const byLabel = new Map<string, InvoicePaymentLine>()
  for (const p of payments) {
    const label = paymentLabel(p.method, p.cardScheme)
    const line = byLabel.get(label.en) ?? { label, method: p.method, amount: 0 }
    line.amount = round2(line.amount + (p.kind === 'REFUND' ? -p.amount : p.amount))
    byLabel.set(label.en, line)
  }

  const lines: InvoiceLine[] = order.lines.map((line, i) => ({
    index: i + 1,
    name: line.name,
    quantity: line.quantity,
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

  const thanks = [
    `${brand}: thank you for your custom.`,
    `Invoice ${order?.ref ?? booking.ref} — ${(order?.total ?? 0).toFixed(2)} ${tenant?.currency ?? 'SAR'}.`,
    '',
    'Follow your booking:',
    tracking,
  ].join('\n')

  if (!isPubliclyFetchable(url)) {
    const withLink = [thanks, '', 'Your invoice:', url].join('\n')
    const fallback = await sendWhatsAppText(booking.customerPhone, withLink)
    return {
      sent: fallback.ok,
      asText: true,
      url,
      reason: fallback.ok
        ? `The message went, but not the PDF: WhatsApp fetches attachments itself and cannot reach ${base}. Point PUBLIC_API_URL at a publicly reachable address to attach the invoice.`
        : fallback.error,
    }
  }

  const result = await sendWhatsAppFile(booking.customerPhone, {
    url,
    caption: thanks,
  })
  return { sent: result.ok, asText: false, url, reason: result.ok ? undefined : result.error }
}

export async function readInvoicePdf(token: string): Promise<{ pdf: Buffer; filename: string } | null> {
  const doc = await InvoiceDoc.findById(token)
  if (!doc) return null
  if (doc.expiresAt.getTime() < Date.now()) return null
  return { pdf: Buffer.from(doc.pdf), filename: `invoice-${doc.orderRef}.pdf` }
}
