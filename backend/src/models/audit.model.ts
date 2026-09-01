import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface AuditDoc {
  _id: string
  tenantId: string
  actorId: string
  action: string
  entity: string
  entityId: string
  reason?: string
  detail?: string
  at: Date
}

const auditSchema = new Schema<AuditDoc>(
  {
    _id: { type: String, default: () => `aud_${nanoid(12)}` },
    tenantId: { type: String, required: true, index: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true, index: true },
    reason: { type: String },
    detail: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

export const Audit = mongoose.model<AuditDoc>('Audit', auditSchema)
