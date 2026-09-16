import type { EngineKind } from '../domain/types.js'
import type { ZakatAssessment, ZatcaReturn } from '../domain/tax.js'

export interface PeriodFilter {
  from?: string
  to?: string
  engineKind?: EngineKind
}

export interface ReportRange {
  from?: string
  to?: string
}

export interface BilingualLabel {
  en: string
  ar: string
}

export interface ActivityFigures {
  engineKind: EngineKind
  label: BilingualLabel
  salesBase: number
  salesVat: number
  salesTotal: number
  returnsBase: number
  returnsVat: number
  returnsTotal: number
  netBase: number
}

export interface MoneyBucket {
  base: number
  vat: number
  total: number
}

export interface SalesTotals {
  salesBase: number
  salesVat: number
  salesTotal: number
  returnsBase: number
  returnsVat: number
  returnsTotal: number
}

export interface ActivityBreakdown {
  vatRate: number
  from: string | null
  to: string | null
  activities: ActivityFigures[]
  purchases: MoneyBucket
  totals: SalesTotals
}

export interface VatReturn extends ZatcaReturn {
  from: string | null
  to: string | null
  activities: ActivityFigures[]
}

export interface ZakatReport extends ZakatAssessment {
  from: string | null
  to: string | null
  vatDue: number
}

export type LedgerEntryType = 'SALE' | 'RETURN' | 'EXPENSE'

export interface LedgerRow {
  date: Date
  processType: string
  details: string
  reference: string
  baseAmount: number
  vatAmount: number
  totalAmount: number
  engineKind: EngineKind | null
  activity: string
  entryType: LedgerEntryType
}
