import mongoose, { Schema } from 'mongoose'

export const TRIP_STATUSES = ['READY', 'CLAIMED', 'RUNNING', 'COMPLETED', 'CANCELLED'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export interface TripPassenger {
  bookingId: string
  bookingRef: string
  customerName: string
  people: number
}

export interface TripLeg {
  stationId: string
  name: string
}

export interface TripStop {
  stationId: string
  name: string
  at: Date
}

export interface TripDoc {
  _id: string
  ref: string
  tenantId: string
  stationId: string
  kioskId: string | null
  assetTypeId: string
  assetTypeName: string
  seats: number
  assetUnitId: string | null
  assetUnitIdentifier: string | null
  passengers: TripPassenger[]
  headcount: number
  status: TripStatus
  captainId: string | null
  captainName: string | null
  stops: TripStop[]
  route: TripLeg[]
  createdBy: string
  startedAt: Date | null
  endedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const passengerSchema = new Schema<TripPassenger>(
  {
    bookingId: { type: String, required: true },
    bookingRef: { type: String, default: '' },
    customerName: { type: String, default: '' },
    people: { type: Number, default: 1 },
  },
  { _id: false },
)

const legSchema = new Schema<TripLeg>(
  {
    stationId: { type: String, required: true },
    name: { type: String, default: '' },
  },
  { _id: false },
)

const stopSchema = new Schema<TripStop>(
  {
    stationId: { type: String, required: true },
    name: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const tripSchema = new Schema<TripDoc>(
  {
    _id: { type: String, required: true },
    ref: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null, index: true },
    assetTypeId: { type: String, required: true, index: true },
    assetTypeName: { type: String, default: '' },
    seats: { type: Number, default: 1 },
    assetUnitId: { type: String, default: null },
    assetUnitIdentifier: { type: String, default: null },
    passengers: { type: [passengerSchema], default: [] },
    headcount: { type: Number, default: 0 },
    status: { type: String, default: 'READY', index: true },
    captainId: { type: String, default: null, index: true },
    captainName: { type: String, default: null },
    stops: { type: [stopSchema], default: [] },
    route: { type: [legSchema], default: [] },
    createdBy: { type: String, required: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { _id: false, timestamps: true },
)

export const Trip = mongoose.model<TripDoc>('Trip', tripSchema)
