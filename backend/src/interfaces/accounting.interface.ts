import type { EngineKind } from '../domain/types.js'
import type { ZakatAssessment, ZatcaReturn } from '../domain/tax.js'

export interface PeriodFilter {
  from?: string
  to?: string
  /** Narrow to one built-in engine. Only meaningful for a tenant that runs them. */
  engineKind?: EngineKind
  /**
   * Narrow to one of the tenant's own activities.
   *
   * The same question as `engineKind` asked of a company that defined its own lines of
   * business. Both exist because both kinds of company exist; a given request carries at most
   * one of them, and a company only ever sees the one that applies to it.
   */
  activityKey?: string
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
  /** The line: an activity key for a company with its own, an engine name for one without. */
  key: string
  /** Set only when the line is a built-in engine, so existing engine filters keep working. */
  engineKind: EngineKind | null
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
