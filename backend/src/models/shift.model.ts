import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface ShiftDoc {
  _id: string
  tenantId: string
  stationId: string
  agentId: string
  status: 'OPEN' | 'RECONCILING' | 'CLOSED'
  openedAt: Date
  closedAt?: Date | null
  expectedCash: number
  countedCash?: number | null
  variance?: number | null
  resolutionNote?: string
  createdAt: Date
  updatedAt: Date
}

const shiftSchema = new Schema<ShiftDoc>(
  {
    _id: { type: String, default: () => `shift_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    status: { type: String, default: 'OPEN' },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    expectedCash: { type: Number, default: 0 },
    countedCash: { type: Number, default: null },
    variance: { type: Number, default: null },
    resolutionNote: { type: String },
  },
  { _id: false, timestamps: true },
)

export const Shift = mongoose.model<ShiftDoc>('Shift', shiftSchema)
