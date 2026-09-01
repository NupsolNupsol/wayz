import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'
import type { EngineKind, IncidentType } from '../domain/types.js'

export interface IncidentDoc {
  _id: string
  ref: string
  tenantId: string
  stationId: string
  bookingId?: string | null
  engineKind?: EngineKind | null
  type: IncidentType
  status: 'REPORTED' | 'INVESTIGATING' | 'AWAITING_APPROVAL' | 'RESOLVED' | 'REJECTED'
  description: string
  reportedBy: string
  createdAt: Date
  updatedAt: Date
}

const incidentSchema = new Schema<IncidentDoc>(
  {
    _id: { type: String, default: () => `inc_${nanoid(10)}` },
    ref: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    bookingId: { type: String, default: null },
    engineKind: { type: String, default: null },
    type: { type: String, required: true },
    status: { type: String, default: 'REPORTED' },
    description: { type: String, required: true },
    reportedBy: { type: String, required: true },
  },
  { _id: false, timestamps: true },
)

export const Incident = mongoose.model<IncidentDoc>('Incident', incidentSchema)
