import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface CustomerDoc {
  _id: string
  tenantId: string
  name: string
  phone: string
  email?: string
  vatId?: string
  phoneVerifiedAt?: Date | null
  active?: boolean
  createdAt: Date
  updatedAt: Date
}

const customerSchema = new Schema<CustomerDoc>(
  {
    _id: { type: String, default: () => `cust_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String },
    vatId: { type: String },
    phoneVerifiedAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { _id: false, timestamps: true },
)

customerSchema.index({ tenantId: 1, phone: 1 })

export const Customer = mongoose.model<CustomerDoc>('Customer', customerSchema)
