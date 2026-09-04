import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface OrderLine {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  isDeposit: boolean
  taxable: boolean
}

export interface ResourceHold {
  assetTypeId: string
  quantityRequired: number
  expiresAt: Date
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED'
}

export interface OrderDoc {
  _id: string
  ref: string
  tenantId: string
  stationId: string
  kioskId: string | null
  agentId: string
  customerId: string
  engineKind: string
  lines: OrderLine[]
  hold: ResourceHold | null
  status: 'DRAFT' | 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED'
  subtotal: number
  vat: number
  depositTotal: number
  total: number
  createdAt: Date
  updatedAt: Date
}

const lineSchema = new Schema<OrderLine>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    isDeposit: { type: Boolean, default: false },
    taxable: { type: Boolean, default: true },
  },
  { _id: false },
)

const holdSchema = new Schema<ResourceHold>(
  {
    assetTypeId: { type: String, required: true },
    quantityRequired: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, default: 'ACTIVE' },
  },
  { _id: false },
)

const orderSchema = new Schema<OrderDoc>(
  {
    _id: { type: String, default: () => `ord_${nanoid(10)}` },
    ref: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null, index: true },
    agentId: { type: String, required: true },
    customerId: { type: String, required: true },
    engineKind: { type: String, required: true },
    lines: { type: [lineSchema], default: [] },
    hold: { type: holdSchema, default: null },
    status: { type: String, default: 'DRAFT', index: true },
    subtotal: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    depositTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false, timestamps: true },
)

export const Order = mongoose.model<OrderDoc>('Order', orderSchema)
