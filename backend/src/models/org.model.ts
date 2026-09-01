import mongoose, { Schema } from 'mongoose'
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
export const Site = mongoose.model<SiteDoc>('Site', siteSchema)

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
export const Zone = mongoose.model<ZoneDoc>('Zone', zoneSchema)

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
  },
  { _id: false, timestamps: true },
)
export const Station = mongoose.model<StationDoc>('Station', stationSchema)

export interface KioskDoc {
  _id: string
  tenantId: string
  siteId: string
  stationId: string
  name: string
  code?: string
  location?: string
  engineKinds: EngineKind[]
  active: boolean
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
    engineKinds: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { _id: false, timestamps: true },
)

export const Kiosk = mongoose.model<KioskDoc>('Kiosk', kioskSchema)
