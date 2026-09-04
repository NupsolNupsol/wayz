import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'
import type { EngineKind, Role } from '../domain/types.js'

export const NOTIFICATION_LEVELS = ['info', 'success', 'warning', 'danger'] as const
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number]

export interface NotificationDoc {
  _id: string
  tenantId: string
  stationId: string
  kioskId: string | null
  engineKind: EngineKind | null
  title: string
  body: string
  level: NotificationLevel
  audience: Role[]
  link: string | null
  readBy: string[]
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    _id: { type: String, default: () => `ntf_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, default: '', index: true },
    kioskId: { type: String, default: null, index: true },
    engineKind: { type: String, default: null, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    level: { type: String, default: 'info' },
    audience: { type: [String], default: [] },
    link: { type: String, default: null },
    readBy: { type: [String], default: [] },
  },
  { _id: false, timestamps: true },
)

notificationSchema.index({ tenantId: 1, createdAt: -1 })

export const Notification = mongoose.model<NotificationDoc>('Notification', notificationSchema)
