import mongoose, { Schema } from 'mongoose'
import type { EngineKind } from '../domain/types.js'
import type { CardScheme } from '../domain/commission.js'

export const TRANSACTION_SOURCES = ['TPE', 'ETL', 'MANUAL'] as const
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number]

export const TRANSACTION_STATUSES = ['CAPTURED', 'SETTLED', 'REFUNDED', 'REVERSED'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export interface CardTransactionDoc {
  _id: string
  tenantId: string
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
  vatRate: number
  engineKind: EngineKind | null
  stationId: string | null
  paymentId: string | null
  bookingId: string | null
  capturedAt: Date
  settlementDate: Date | null
  status: TransactionStatus
  batchId: string
  createdAt: Date
  updatedAt: Date
}

const cardTransactionSchema = new Schema<CardTransactionDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    source: { type: String, required: true, index: true },
    externalRef: { type: String, required: true },
    terminalId: { type: String, default: '' },
    scheme: { type: String, required: true, index: true },
    maskedPan: { type: String, default: '' },
    authCode: { type: String, default: '' },
    currency: { type: String, default: 'SAR' },
    grossAmount: { type: Number, required: true },
    commissionRate: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    netSettled: { type: Number, required: true },
    baseAmount: { type: Number, required: true },
    vatAmount: { type: Number, required: true },
    vatRate: { type: Number, required: true },
    engineKind: { type: String, default: null, index: true },
    stationId: { type: String, default: null },
    paymentId: { type: String, default: null, index: true },
    bookingId: { type: String, default: null },
    capturedAt: { type: Date, required: true, index: true },
    settlementDate: { type: Date, default: null },
    status: { type: String, default: 'CAPTURED', index: true },
    batchId: { type: String, default: '' },
  },
  { _id: false, timestamps: true },
)

cardTransactionSchema.index({ tenantId: 1, externalRef: 1 }, { unique: true })
cardTransactionSchema.index({ tenantId: 1, capturedAt: -1 })

export const CardTransaction =
  (mongoose.models.CardTransaction as mongoose.Model<CardTransactionDoc>) ??
  mongoose.model<CardTransactionDoc>('CardTransaction', cardTransactionSchema)

export interface CommissionRateDoc {
  _id: string
  tenantId: string
  scheme: CardScheme
  rate: number
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

const commissionRateSchema = new Schema<CommissionRateDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    scheme: { type: String, required: true },
    rate: { type: Number, required: true, min: 0 },
    updatedBy: { type: String, default: '' },
  },
  { _id: false, timestamps: true },
)

commissionRateSchema.index({ tenantId: 1, scheme: 1 }, { unique: true })

export const CommissionRate =
  (mongoose.models.CommissionRate as mongoose.Model<CommissionRateDoc>) ??
  mongoose.model<CommissionRateDoc>('CommissionRate', commissionRateSchema)
