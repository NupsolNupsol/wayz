import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface NotificationDoc {
  _id: string
  tenantId: string
  stationId: string
  title: string
  body: string
  level: 'info' | 'warning' | 'danger' | 'success'
  read: boolean
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    _id: { type: String, default: () => `ntf_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    level: { type: String, default: 'info' },
    read: { type: Boolean, default: false },
  },
  { _id: false, timestamps: true },
)

export const Notification = mongoose.model<NotificationDoc>('Notification', notificationSchema)
