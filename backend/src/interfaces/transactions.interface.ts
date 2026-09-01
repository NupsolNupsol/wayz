import type { EngineKind } from '../domain/types.js'
import type { CardScheme } from '../domain/commission.js'
import type { TransactionSource, TransactionStatus } from '../models/index.js'
import type { PeriodFilter } from './accounting.interface.js'

export interface RateInput {
  rates: Partial<Record<CardScheme, number>>
  repriceUnsettled?: boolean
}

export interface RawTransaction {
  externalRef: string
  scheme: string
  grossAmount: number
  capturedAt?: string
  terminalId?: string
  maskedPan?: string
  authCode?: string
  currency?: string
  engineKind?: EngineKind | null
  stationId?: string | null
  paymentId?: string | null
  bookingId?: string | null
  settlementDate?: string | null
  status?: TransactionStatus
  source?: TransactionSource
}

export interface IngestRejection {
  externalRef: string
  reason: string
}

export interface IngestResult {
  batchId: string
  received: number
  imported: number
  duplicates: number
  rejected: IngestRejection[]
  grossAmount: number
  commissionAmount: number
  netSettled: number
}

export interface TransactionFilter extends PeriodFilter {
  scheme?: CardScheme
  status?: TransactionStatus
  source?: TransactionSource
  limit?: number
}

export type ReconciliationStatus =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'SCHEME_MISMATCH'
  | 'MISSING_IN_PLATFORM'
  | 'MISSING_AT_TERMINAL'

export interface ReconciliationRow {
  externalRef: string
  transactionId: string | null
  paymentId: string | null
  scheme: CardScheme | null
  recordedScheme: CardScheme | null
  terminalAmount: number | null
  platformAmount: number | null
  difference: number
  status: ReconciliationStatus
  capturedAt: string | null
}
