import { http, unwrap } from './client'
import type { PaymentMethod } from './types'

export type InvoiceLineKind = 'ITEM' | 'PENALTY' | 'OVERTIME' | 'DELIVERY' | 'DEPOSIT'

export interface InvoiceLine {
  index: number
  name: string
  quantity: number
  unitPrice: number
  total: number
  isDeposit: boolean
  kind?: InvoiceLineKind
}

export interface InvoicePaymentLine {
  label: { en: string; ar: string }
  method: PaymentMethod
  amount: number
}

export interface Invoice {
  number: string
  issuedAt: string
  seller: { name: string; legalName: string; crNumber: string; vatNumber: string; currency: string }
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

export const invoiceApi = {
  forBooking: (bookingId: string) => unwrap<Invoice>(http.get(`/bookings/${bookingId}/invoice`)),
}
