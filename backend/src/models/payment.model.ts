import mongoose, { Schema, type HydratedDocument } from 'mongoose'
import { nanoid } from 'nanoid'
import type { PaymentKind, PaymentMethod } from '../domain/types.js'
import type { CardScheme } from '../domain/commission.js'

export interface PaymentDoc {
  _id: string
  tenantId: string
  stationId: string
  orderId: string
  bookingId?: string | null
  amount: number
  baseAmount: number
  vatAmount: number
  vatRate: number
  engineKind: string | null
  method: PaymentMethod
  cardScheme: CardScheme | null
  kind: PaymentKind
  status: 'PENDING' | 'CAPTURED' | 'REFUNDED'
  takenBy: string
  shiftId: string | null
  createdAt: Date
  updatedAt: Date
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    _id: { type: String, default: () => `pay_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    bookingId: { type: String, default: null },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
    engineKind: { type: String, default: null, index: true },
    method: { type: String, required: true },
    cardScheme: { type: String, default: null, index: true },
    kind: { type: String, default: 'SALE' },
    status: { type: String, default: 'CAPTURED' },
    takenBy: { type: String, default: '' },
    shiftId: { type: String, default: null, index: true },
  },
  { _id: false, timestamps: true },
)

export const Payment = mongoose.model<PaymentDoc>('Payment', paymentSchema)

export type PaymentHydrated = HydratedDocument<PaymentDoc>
