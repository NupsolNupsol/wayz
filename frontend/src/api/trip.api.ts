import { http, unwrap } from './client'
import type { MapPoint } from '@/components/StationMap'

export type TripStatus = 'FILLING' | 'READY' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED'

export interface TripPassenger {
  bookingId: string
  bookingRef: string
  customerName: string
  people: number
}

export interface TripStop {
  stationId: string
  name: string
  at: string
}

export interface TripLeg {
  stationId: string
  name: string
}

export interface Trip {
  _id: string
  ref: string
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
  startedAt: string | null
  endedAt: string | null
  createdAt: string
}

export interface WaitingGroup {
  assetTypeId: string
  name: string
  seats: number
  people: number
  boatsNeeded: number
  bookings: { _id: string; ref: string; customerName: string; people: number }[]
}

export interface TripBoard {
  ready: Trip[]
  running: Trip[]
  done: Trip[]
  filling: Trip[]
}

export interface BoatSpace {
  _id: string
  identifier: string
  assetTypeId: string
  assetTypeName: string
  seats: number
  taken: number
  free: number
  tripId: string | null
  tripRef: string | null
  status: 'EMPTY' | 'FILLING' | 'FULL'
}

export const tripApi = {
  boats: (assetTypeId?: string) =>
    unwrap<BoatSpace[]>(http.get('/lagoon/trips/boats', { params: assetTypeId ? { assetTypeId } : undefined })),
  release: (id: string) => unwrap<Trip>(http.post(`/lagoon/trips/${id}/release`, {})),
  board: (mine = false) => unwrap<TripBoard>(http.get('/lagoon/trips', { params: mine ? { mine: 'true' } : undefined })),
  detail: (id: string) => unwrap<{ trip: Trip; stations: MapPoint[] }>(http.get(`/lagoon/trips/${id}`)),
  setRoute: (id: string, stationIds: string[]) => unwrap<Trip>(http.post(`/lagoon/trips/${id}/route`, { stationIds })),
  claim: (id: string) => unwrap<Trip>(http.post(`/lagoon/trips/${id}/claim`, {})),
  start: (id: string, unitId?: string) => unwrap<Trip>(http.post(`/lagoon/trips/${id}/start`, unitId ? { unitId } : {})),
  clock: (id: string, stationId: string) => unwrap<Trip>(http.post(`/lagoon/trips/${id}/stops`, { stationId })),
  complete: (id: string) => unwrap<Trip>(http.post(`/lagoon/trips/${id}/complete`, {})),
}
