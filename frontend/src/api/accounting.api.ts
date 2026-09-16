import { http, unwrap } from './client'
import type { CardScheme } from '@/config/cardSchemes'
import type { EngineKind } from './types'

export interface ActivityLabel {
  en: string
  ar: string
}

export interface ActivityFigures {
  engineKind: EngineKind
  label: ActivityLabel
  salesBase: number
  salesVat: number
  salesTotal: number
  returnsBase: number
  returnsVat: number
  returnsTotal: number
  netBase: number
}

export interface AccountingSummary {
  vatRate: number
  from: string | null
  to: string | null
  activities: ActivityFigures[]
  purchases: { base: number; vat: number; total: number }
  totals: {
    salesBase: number
    salesVat: number
    salesTotal: number
    returnsBase: number
    returnsVat: number
    returnsTotal: number
  }
}

export interface VatReturn {
  vatRate: number
  from: string | null
  to: string | null
  salesBase: number
  salesVat: number
  returnsBase: number
  returnsVat: number
  purchasesBase: number
  purchasesVat: number
  netTaxableBase: number
  dueVat: number
  refundable: boolean
  activities: ActivityFigures[]
}

export interface ZakatReport {
  from: string | null
  to: string | null
  revenue: number
  costs: number
  vatPaid: number
  netProfit: number
  zakatRate: number
  zakatDue: number
  profitable: boolean
  vatDue: number
}

export interface LedgerRow {
  date: string
  processType: string
  details: string
  reference: string
  baseAmount: number
  vatAmount: number
  totalAmount: number
  engineKind: EngineKind | null
  activity: string
  entryType: 'SALE' | 'RETURN' | 'EXPENSE'
}

export { CARD_SCHEMES, type CardScheme } from '@/config/cardSchemes'

export const TRANSACTION_SOURCES = ['TPE', 'ETL', 'MANUAL'] as const
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number]

export const TRANSACTION_STATUSES = ['CAPTURED', 'SETTLED', 'REFUNDED', 'REVERSED'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export interface CommissionRateRow {
  scheme: CardScheme
  label: { en: string; ar: string }
  rate: number
  defaultRate: number
  isDefault: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export interface CardTransaction {
  _id: string
  source: TransactionSource
  externalRef: string
  terminalId: string
  scheme: CardScheme
  maskedPan: string
  authCode: string
  currency: string
  grossAmount: number
  commissionRate: number
  commissionAmount: number
  netSettled: number
  baseAmount: number
  vatAmount: number
  engineKind: EngineKind | null
  paymentId: string | null
  capturedAt: string
  settlementDate: string | null
  status: TransactionStatus
}

export interface SchemeFigures {
  scheme: CardScheme
  label: { en: string; ar: string }
  rate: number
  count: number
  grossAmount: number
  commissionAmount: number
  netSettled: number
  share: number
}

export interface TransactionSummary {
  from: string | null
  to: string | null
  byScheme: SchemeFigures[]
  totals: {
    count: number
    grossAmount: number
    commissionAmount: number
    netSettled: number
    effectiveRate: number
    baseAmount: number
    vatAmount: number
  }
  credits: { count: number; grossAmount: number }
}

export interface ReconciliationRow {
  externalRef: string
  transactionId: string | null
  paymentId: string | null
  scheme: CardScheme | null
  terminalAmount: number | null
  platformAmount: number | null
  difference: number
  recordedScheme: CardScheme | null
  status: 'MATCHED' | 'AMOUNT_MISMATCH' | 'SCHEME_MISMATCH' | 'MISSING_IN_PLATFORM' | 'MISSING_AT_TERMINAL'
  capturedAt: string | null
}

export interface Reconciliation {
  from: string | null
  to: string | null
  rows: ReconciliationRow[]
  compared: number
  totals: {
    terminal: number
    platform: number
    matched: number
    amountMismatch: number
    schemeMismatch: number
    missingInPlatform: number
    missingAtTerminal: number
    balanced: boolean
  }
}

export interface IngestResult {
  batchId: string
  received: number
  imported: number
  duplicates: number
  rejected: { externalRef: string; reason: string }[]
  grossAmount: number
  commissionAmount: number
  netSettled: number
}

export interface RawTransaction {
  externalRef: string
  scheme: string
  grossAmount: number
  capturedAt?: string
  terminalId?: string
  maskedPan?: string
  authCode?: string
  engineKind?: EngineKind | null
  paymentId?: string | null
  status?: TransactionStatus
  source?: TransactionSource
}

export interface TransactionFilter extends PeriodFilter {
  scheme?: CardScheme
  status?: TransactionStatus
  source?: TransactionSource
  limit?: number
}

export interface LedgerPayment {
  _id: string
  ref: string
  bookingId: string | null
  customerName: string
  amount: number
  baseAmount: number
  vatAmount: number
  method: 'CASH' | 'CARD'
  cardScheme: CardScheme | null
  kind: string
  status: string
  engineKind: EngineKind | null
  takenBy: string
  takenByName: string
  createdAt: string
  transactionId: string | null
  externalRef: string | null
}

export interface ReconciliationCheck {
  matched: boolean
  schemeAgrees: boolean
  amountAgrees: boolean
  difference: number | null
  expectedAtTerminal?: boolean
}

export interface TransactionDetail extends CardTransaction {
  label: { en: string; ar: string }
  payment: {
    _id: string
    amount: number
    method: 'CASH' | 'CARD'
    cardScheme: CardScheme | null
    kind: string
    takenBy: string
    createdAt: string
  } | null
  booking: { _id: string; ref: string; customerName: string } | null
  reconciliation: ReconciliationCheck
}

export interface PaymentDetail {
  _id: string
  ref: string
  customerName: string
  amount: number
  baseAmount: number
  vatAmount: number
  vatRate: number
  method: 'CASH' | 'CARD'
  cardScheme: CardScheme | null
  kind: string
  status: string
  engineKind: EngineKind | null
  bookingId: string | null
  orderId: string
  takenBy: string
  takenByName: string
  shiftId: string | null
  createdAt: string
  transaction: {
    _id: string
    externalRef: string
    scheme: CardScheme
    grossAmount: number
    commissionAmount: number
    commissionRate: number
    netSettled: number
    status: string
    capturedAt: string
  } | null
  reconciliation: ReconciliationCheck
}

export interface PaymentLedgerFilter extends PeriodFilter {
  method?: 'CASH' | 'CARD'
  kind?: string
  scheme?: CardScheme
  limit?: number
}

export interface PeriodFilter {
  from?: string
  to?: string
  engineKind?: EngineKind
}

export const accountingApi = {
  summary: (params: PeriodFilter) => unwrap<AccountingSummary>(http.get('/accounting/summary', { params })),
  vatReturn: (params: PeriodFilter) => unwrap<VatReturn>(http.get('/accounting/vat-return', { params })),
  ledger: (params: PeriodFilter) => unwrap<LedgerRow[]>(http.get('/accounting/ledger', { params })),
  zakat: (params: PeriodFilter) => unwrap<ZakatReport>(http.get('/accounting/zakat', { params })),
  transaction: (id: string) => unwrap<TransactionDetail>(http.get(`/accounting/transactions/${id}`)),
  payments: (params: PaymentLedgerFilter) => unwrap<LedgerPayment[]>(http.get('/accounting/payments', { params })),
  payment: (id: string) => unwrap<PaymentDetail>(http.get(`/accounting/payments/${id}`)),
  commissionRates: () => unwrap<CommissionRateRow[]>(http.get('/accounting/commission-rates')),
  updateCommissionRates: (rates: Partial<Record<CardScheme, number>>, repriceUnsettled = false) =>
    unwrap<{ rates: CommissionRateRow[]; repriced: number }>(
      http.put('/accounting/commission-rates', { rates, repriceUnsettled }),
    ),
  transactions: (params: TransactionFilter) => unwrap<CardTransaction[]>(http.get('/accounting/transactions', { params })),
  transactionSummary: (params: TransactionFilter) =>
    unwrap<TransactionSummary>(http.get('/accounting/transactions/summary', { params })),
  reconciliation: (params: TransactionFilter) => unwrap<Reconciliation>(http.get('/accounting/reconciliation', { params })),
  ingest: (transactions: RawTransaction[], source: TransactionSource = 'ETL') =>
    unwrap<IngestResult>(http.post('/accounting/transactions/ingest', { transactions, source })),
  exportUrl: (params: PeriodFilter) => {
    const q = new URLSearchParams()
    if (params.from) q.set('from', params.from)
    if (params.to) q.set('to', params.to)
    if (params.engineKind) q.set('engineKind', params.engineKind)
    return `/accounting/export?${q.toString()}`
  },
  download: async (params: PeriodFilter) => {
    const res = await http.get(accountingApi.exportUrl(params), { responseType: 'blob' })
    return res.data as Blob
  },
  downloadActivityWorkbook: async (engineKind: EngineKind, params: PeriodFilter) => {
    const res = await http.get(`/accounting/export/activity/${engineKind}`, {
      params: { from: params.from, to: params.to },
      responseType: 'blob',
    })
    return res.data as Blob
  },
  downloadFullWorkbook: async (params: PeriodFilter) => {
    const res = await http.get('/accounting/export/all', {
      params: { from: params.from, to: params.to },
      responseType: 'blob',
    })
    return res.data as Blob
  },
}
