import { Schema } from 'mongoose'
import type { EngineKind } from '../domain/types.js'

export interface SiteDoc {
  _id: string
  tenantId: string
  name: string
  city: string
  venueType?: string
  address?: string
  contactPhone?: string
  active: boolean
}
const siteSchema = new Schema<SiteDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    city: { type: String, required: true },
    venueType: { type: String, default: 'MALL' },
    address: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { _id: false, timestamps: true },
)
export const SiteSchema = siteSchema

export interface ZoneDoc {
  _id: string
  tenantId: string
  siteId: string
  name: string
}
const zoneSchema = new Schema<ZoneDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    name: { type: String, required: true },
  },
  { _id: false, timestamps: true },
)
export const ZoneSchema = zoneSchema

export interface StationDoc {
  _id: string
  tenantId: string
  siteId: string
  zoneId: string
  name: string
  code?: string
  engineKinds: EngineKind[]
  openingTime?: string
  closingTime?: string
  contactPhone?: string
  active: boolean
  mapX?: number | null
  mapY?: number | null
}
const stationSchema = new Schema<StationDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    zoneId: { type: String, default: '' },
    name: { type: String, required: true },
    code: { type: String, default: '' },
    engineKinds: { type: [String], default: [] },
    openingTime: { type: String, default: '08:00' },
    closingTime: { type: String, default: '22:00' },
    contactPhone: { type: String, default: '' },
    active: { type: Boolean, default: true },
    mapX: { type: Number, default: null },
    mapY: { type: Number, default: null },
  },
  { _id: false, timestamps: true },
)
export const StationSchema = stationSchema

export interface KioskDoc {
  _id: string
  tenantId: string
  siteId: string
  stationId: string
  name: string
  code?: string
  location?: string
  engineKind: EngineKind
  /** An exit the customer leaves by. Shop & Drop bags are sent to one of these to be collected. */
  isExitGate: boolean
  active: boolean
  mapX?: number | null
  mapY?: number | null
  createdAt: Date
  updatedAt: Date
}

const kioskSchema = new Schema<KioskDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, default: '' },
    location: { type: String, default: '' },
    engineKind: { type: String, required: true, index: true },
    isExitGate: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    mapX: { type: Number, default: null },
    mapY: { type: Number, default: null },
  },
  { _id: false, timestamps: true },
)

export const KioskSchema = kioskSchema

/**
 * A gate: the place at a station where the lockers actually are.
 *
 * A desk and a gate are both places inside a venue, but they are not the same kind of thing and
 * collapsing them was the misconception this model exists to correct. A Shop & Drop desk is a
 * point of sale — an agent, a till, a queue — and holds no compartments at all; the customer's
 * bags are carried to a gate and stored there. A gate is activity-agnostic by nature: it holds
 * Shop & Drop lockers while a Mobility desk stands beside it serving scooters, which is why it
 * cannot be a Kiosk with a flag — a Kiosk runs exactly one activity, and a gate runs none.
 *
 * It belongs to a station rather than sitting beside one. At Boulevard World the station is the
 * venue and the gates are entrances within it, so a gate outside a station would be a gate into
 * nothing, and every query already scoped by station would have to learn a second way to reach it.
 */
export interface GateDoc {
  _id: string
  tenantId: string
  siteId: string
  stationId: string
  name: string
  code?: string
  location?: string
  active: boolean
  mapX?: number | null
  mapY?: number | null
  createdAt: Date
  updatedAt: Date
}

const gateSchema = new Schema<GateDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, default: '' },
    location: { type: String, default: '' },
    active: { type: Boolean, default: true },
    mapX: { type: Number, default: null },
    mapY: { type: Number, default: null },
  },
  { _id: false, timestamps: true },
)

gateSchema.index({ tenantId: 1, stationId: 1, active: 1 })

export const GateSchema = gateSchema
