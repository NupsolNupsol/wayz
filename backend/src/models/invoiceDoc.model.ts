import mongoose, { Schema } from 'mongoose'
import { randomBytes } from 'node:crypto'

export interface InvoiceDocDoc {
  _id: string
  tenantId: string
  bookingId: string
  orderRef: string
  pdf: Buffer
  expiresAt: Date
  createdAt: Date
}

const invoiceDocSchema = new Schema<InvoiceDocDoc>(
  {
    _id: { type: String, default: () => randomBytes(24).toString('base64url') },
    tenantId: { type: String, required: true, index: true },
    bookingId: { type: String, required: true, index: true },
    orderRef: { type: String, required: true },
    pdf: { type: Buffer, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
)

invoiceDocSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const InvoiceDoc = mongoose.model<InvoiceDocDoc>('InvoiceDoc', invoiceDocSchema)
