import { Schema } from 'mongoose'

import type { InventoryCategory } from '../domain/rules.js'

/**
 * A purchase order — §8.2.
 *
 * The flow the specification describes:
 *
 * ```
 * DRAFT ──submit──▶ AWAITING_APPROVAL ──approve──▶ APPROVED ──receive──▶ RECEIVED
 *                          │                            │           └──▶ PARTIALLY_RECEIVED
 *                          └───────── reject ───────────┴──────────────▶ REJECTED / CANCELLED
 * ```
 *
 * Who approves depends on what it costs — Administrative Manager for standard items, CEO or
 * Project Manager above a threshold the specification never defines. Both the roles and the
 * threshold are configuration; see `ProcurementRules`.
 */

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'REJECTED'
  | 'CANCELLED'

export interface PurchaseOrderLine {
  /** What is being bought. Free text: a supplier's catalogue is not ours to model. */
  description: string
  category: InventoryCategory
  quantity: number
  unit: string
  unitPrice: number
  /** §8.2: *"receiving party confirms receipt with quantity verification"*. */
  receivedQuantity: number
}

export interface PurchaseOrderEvent {
  action: string
  by: string
  byName: string
  role: string
  at: Date
  note?: string
}

export interface PurchaseOrderDoc {
  _id: string
  tenantId: string
  ref: string

  /** Which location the stock is for. §8.1 tracks most categories per location. */
  siteId: string

  supplier: string
  lines: PurchaseOrderLine[]
  total: number

  /**
   * Whether this order needed the higher approval.
   *
   * Recorded at submission rather than recomputed, because the threshold is configuration and
   * may change — an order approved last month should still show the rule it was approved under.
   */
  highValue: boolean

  /**
   * §8.2: *"Veterinary supply purchases require supporting documentation (vet prescription
   * where applicable)."* A reference to whatever was supplied; the specification does not say
   * the document itself is stored, so a reference is what is kept.
   */
  supportingDocument: string

  status: PurchaseOrderStatus
  raisedBy: string
  approvedBy: string | null
  approvedAt: Date | null
  receivedAt: Date | null

  log: PurchaseOrderEvent[]
  createdAt: Date
  updatedAt: Date
}

const lineSchema = new Schema<PurchaseOrderLine>(
  {
    description: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: 'unit' },
    unitPrice: { type: Number, required: true, min: 0 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
)

const eventSchema = new Schema<PurchaseOrderEvent>(
  {
    action: { type: String, required: true },
    by: { type: String, required: true },
    byName: { type: String, default: '' },
    role: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false },
)

export const PurchaseOrderSchema = new Schema<PurchaseOrderDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    ref: { type: String, required: true },

    siteId: { type: String, required: true, index: true },

    supplier: { type: String, default: '' },
    lines: { type: [lineSchema], default: [] },
    total: { type: Number, default: 0 },

    highValue: { type: Boolean, default: false },
    supportingDocument: { type: String, default: '' },

    status: { type: String, default: 'DRAFT', index: true },
    raisedBy: { type: String, required: true },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },

    log: { type: [eventSchema], default: [] },
  },
  { _id: false, timestamps: true },
)
