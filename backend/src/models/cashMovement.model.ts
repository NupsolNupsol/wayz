import mongoose, { Schema } from 'mongoose'

export const CASH_MOVEMENT_KINDS = ['FLOAT_IN', 'PAY_OUT', 'DROP'] as const
export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[number]

export const MOVEMENT_SIGN: Record<CashMovementKind, 1 | -1> = {
  FLOAT_IN: 1,
  PAY_OUT: -1,
  DROP: -1,
}

export interface CashMovementDoc {
  _id: string
  tenantId: string
  stationId: string
  shiftId: string
  actorId: string
  kind: CashMovementKind
  amount: number
  baseAmount: number
  vatAmount: number
  vatRate: number
  reason: string
  reference: string
  createdAt: Date
  updatedAt: Date
}

const cashMovementSchema = new Schema<CashMovementDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    shiftId: { type: String, required: true, index: true },
    actorId: { type: String, required: true },
    kind: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    baseAmount: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
    reason: { type: String, required: true },
    reference: { type: String, default: '' },
  },
  { _id: false, timestamps: true },
)

cashMovementSchema.index({ tenantId: 1, shiftId: 1, createdAt: -1 })

export const CashMovement =
  (mongoose.models.CashMovement as mongoose.Model<CashMovementDoc>) ??
  mongoose.model<CashMovementDoc>('CashMovement', cashMovementSchema)
