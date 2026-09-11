import { Schema } from 'mongoose'
import type { DeliveryOrigin, DeliveryStatus } from '../domain/workflow.js'

export interface DeliveryTimelineEntryDoc {
  status: DeliveryStatus
  at: Date
  by: string
  note?: string
}

export interface DeliveryStopDoc {
  bookingId: string
  bookingRef: string
  kioskId: string | null
  kioskName: string
  assetUnitId: string | null
  assetUnitIdentifier: string | null
  bagBarcodes: string[]
  bagCount: number
  status: 'PENDING' | 'COLLECTED'
  scannedBarcodes: string[]
  collectedAt: Date | null
}

export interface DeliveryRequestDoc {
  _id: string
  tenantId: string
  siteId: string
  stationId: string
  kioskId: string | null
  bookingId: string
  bookingRef: string
  customerId: string
  customerName: string
  customerPhone: string
  /**
   * Where the bags are going. Shop & Drop sends them to an exit gate, where the customer collects
   * them from that gate's agent; a `kind` of ADDRESS is the older door-to-door case.
   */
  destination: {
    kind: 'ADDRESS' | 'GATE' | 'GATE_LOCKER'
    /** The gate a storage run is carrying bags *to*. Null on any run going the other way. */
    gateId?: string | null
    address: string
    kioskId: string | null
    kioskName: string
    notes: string
    contactPhone: string
  }
  status: DeliveryStatus
  origin: DeliveryOrigin
  verifiedBy: string | null
  verifiedAt: Date | null
  verificationMethod: string | null
  requestedBy: string
  requestedAt: Date
  assignedTo: string | null
  assignedAt: Date | null
  releaseRequestedAt: Date | null
  releaseApprovedBy: string | null
  releaseApprovedAt: Date | null
  assetUnitId: string | null
  assetUnitIdentifier: string | null
  pickedUpAt: Date | null
  scannedBarcodes: string[]
  deliveredAt: Date | null
  failureReason: string | null
  fee: number
  /** What the bookings on this run owed when it was raised. Recorded, never a blocker. */
  owedAtRequest?: number
  stops: DeliveryStopDoc[]
  timeline: DeliveryTimelineEntryDoc[]
  createdAt: Date
  updatedAt: Date
}

const timelineSchema = new Schema<DeliveryTimelineEntryDoc>(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, required: true },
    note: { type: String },
  },
  { _id: false },
)

const stopSchema = new Schema<DeliveryStopDoc>(
  {
    bookingId: { type: String, required: true },
    bookingRef: { type: String, default: '' },
    kioskId: { type: String, default: null },
    kioskName: { type: String, default: '' },
    assetUnitId: { type: String, default: null },
    assetUnitIdentifier: { type: String, default: null },
    bagBarcodes: { type: [String], default: [] },
    bagCount: { type: Number, default: 0 },
    status: { type: String, default: 'PENDING' },
    scannedBarcodes: { type: [String], default: [] },
    collectedAt: { type: Date, default: null },
  },
  { _id: false },
)

const deliverySchema = new Schema<DeliveryRequestDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null },
    bookingId: { type: String, required: true, index: true },
    bookingRef: { type: String, default: '' },
    customerId: { type: String, required: true },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    destination: {
      kind: { type: String, enum: ['ADDRESS', 'GATE', 'GATE_LOCKER'], default: 'ADDRESS' },
      gateId: { type: String, default: null },
      address: { type: String, required: true },
      kioskId: { type: String, default: null },
      kioskName: { type: String, default: '' },
      notes: { type: String, default: '' },
      contactPhone: { type: String, default: '' },
    },
    status: { type: String, required: true, index: true },
    origin: { type: String, required: true },
    verifiedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    verificationMethod: { type: String, default: null },
    requestedBy: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
    assignedTo: { type: String, default: null, index: true },
    assignedAt: { type: Date, default: null },
    releaseRequestedAt: { type: Date, default: null },
    releaseApprovedBy: { type: String, default: null },
    releaseApprovedAt: { type: Date, default: null },
    assetUnitId: { type: String, default: null },
    assetUnitIdentifier: { type: String, default: null },
    pickedUpAt: { type: Date, default: null },
    scannedBarcodes: { type: [String], default: [] },
    deliveredAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    fee: { type: Number, default: 0 },
    owedAtRequest: { type: Number, default: 0 },
    stops: { type: [stopSchema], default: [] },
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true, versionKey: false, _id: false },
)

deliverySchema.index({ tenantId: 1, siteId: 1, status: 1 })
deliverySchema.index({ tenantId: 1, assignedTo: 1, status: 1 })

export const DeliveryRequestSchema = deliverySchema
