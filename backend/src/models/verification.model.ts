import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface VerificationEvidenceDoc {
  _id: string
  tenantId: string
  stationId: string
  bookingId: string
  purpose: string
  mimeType: string
  sizeBytes: number
  dataUri: string
  capturedBy: string
  createdAt: Date
}

const schema = new Schema<VerificationEvidenceDoc>(
  {
    _id: { type: String, default: () => `evd_${nanoid(12)}` },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    bookingId: { type: String, required: true, index: true },
    purpose: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    dataUri: { type: String, required: true },
    capturedBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

export const VerificationEvidence = mongoose.model<VerificationEvidenceDoc>('VerificationEvidence', schema)
