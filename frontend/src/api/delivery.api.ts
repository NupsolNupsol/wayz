import { http, unwrap } from './client'

export type DeliveryStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'RELEASE_REQUESTED'
  | 'RELEASE_APPROVED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'

export type DeliveryOrigin = 'AT_STORAGE' | 'CUSTOMER_CONTACT'

export interface DeliveryTimelineEntry {
  status: DeliveryStatus
  at: string
  by: string
  note?: string
}

export interface DeliveryStop {
  bookingId: string
  bookingRef: string
  kioskId: string | null
  kioskName: string
  assetUnitId?: string | null
  assetUnitIdentifier: string | null
  bagBarcodes?: string[]
  bagCount: number
  status: 'PENDING' | 'COLLECTED'
  scannedBarcodes?: string[]
  collectedAt: string | null
  active?: boolean
}

export interface CustomerBagsElsewhere {
  bookingId: string
  bookingRef: string
  kioskId: string | null
  kioskName: string
  assetUnitId: string | null
  assetUnitIdentifier: string | null
  bagBarcodes: string[]
  bagCount: number
  stationId: string
  storedAt: string | null
}

export interface Delivery {
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
  destination: {
    /** ADDRESS and GATE go out to a customer; GATE_LOCKER is a storage run coming in. */
    kind?: 'ADDRESS' | 'GATE' | 'GATE_LOCKER'
    address: string
    notes: string
    contactPhone: string
    /** The gate a storage run is carrying bags to, and its name for the courier to read. */
    gateId?: string | null
    kioskName?: string | null
  }
  status: DeliveryStatus
  origin: DeliveryOrigin
  verifiedBy: string | null
  verifiedAt: string | null
  verificationMethod: string | null
  requestedBy: string
  requestedAt: string
  assignedTo: string | null
  assignedAt: string | null
  releaseRequestedAt: string | null
  releaseApprovedBy: string | null
  releaseApprovedAt: string | null
  assetUnitId: string | null
  assetUnitIdentifier: string | null
  pickedUpAt: string | null
  scannedBarcodes: string[]
  deliveredAt: string | null
  failureReason: string | null
  fee: number
  stops?: DeliveryStop[]
  activeStop?: DeliveryStop | null
  atMyKiosk?: boolean
  timeline: DeliveryTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export interface DeliveryBag {
  index: number
  barcode: string | null
  demoScan: string | null
  description: string
  status: string
}

export interface DeliveryDetail {
  amountDue: number
  stops?: DeliveryStop[]
  mine?: boolean
  delivery: Delivery
  bags: DeliveryBag[]
  booking: { _id: string; ref: string; status: string; productName: string } | null
  courier: { _id: string; fullName: string; email: string; phone?: string } | null
  requestedByName: string
  demoScanner: boolean
  transitions: { code: string; label: string; target: DeliveryStatus; style?: { backgroundColor: string } }[]
}

export interface CourierBoard {
  available: Delivery[]
  mine: (Delivery & { amountDue?: number })[]
  history: Delivery[]
}

export interface CreateDeliveryInput {
  bookingId: string
  alsoBookingIds?: string[]
  /** One of the two: the exit gate the customer collects from, or a written address. */
  toKioskId?: string
  address?: string
  notes?: string
  contactPhone?: string
  origin: DeliveryOrigin
  fee?: number
}

export interface DeliveryTransitionPayload {
  confirmCourierId?: string
  handedOver?: boolean
  scannedBarcodes?: string[]
  reason?: string
  note?: string
}

export interface ExitGate {
  _id: string
  name: string
  stationId: string
  location: string
}

export const deliveryApi = {
  exitGates: () => unwrap<ExitGate[]>(http.get('/deliveries/exit-gates')),
  create: (input: CreateDeliveryInput) => unwrap<Delivery>(http.post('/deliveries', input)),
  /** Asks for a customer's bags to be carried from this counter to the gate holding their locker. */
  requestStorageRun: (bookingId: string) => unwrap<Delivery>(http.post('/deliveries/storage-runs', { bookingId })),
  customerBags: (bookingId: string) =>
    unwrap<CustomerBagsElsewhere[]>(http.get(`/deliveries/customer-bags/${bookingId}`)),
  station: (params?: { status?: string; bookingId?: string }) =>
    unwrap<Delivery[]>(http.get('/deliveries/station', { params })),
  stationTransition: (id: string, code: string, payload?: DeliveryTransitionPayload) =>
    unwrap<Delivery>(http.post(`/deliveries/station/${id}/transition`, { code, payload })),

  board: () => unwrap<CourierBoard>(http.get('/deliveries/courier/board')),
  courierTransition: (id: string, code: string, payload?: DeliveryTransitionPayload) =>
    unwrap<Delivery>(http.post(`/deliveries/courier/${id}/transition`, { code, payload })),

  collectStop: (id: string, scannedBarcodes: string[]) =>
    unwrap<Delivery>(http.post(`/deliveries/courier/${id}/collect-stop`, { scannedBarcodes })),
  detail: (id: string) => unwrap<DeliveryDetail>(http.get(`/deliveries/${id}`)),
  collect: (id: string, splits: { method: 'CASH' | 'CARD'; cardScheme?: string | null; amount: number }[]) =>
    unwrap<{ collected: number; due: number }>(http.post(`/deliveries/courier/${id}/collect`, { splits })),
}
