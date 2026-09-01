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
  destination: { address: string; notes: string; contactPhone: string }
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
  compartmentCode: string | null
  compartmentCodeExpiresAt: string | null
  assetUnitId: string | null
  assetUnitIdentifier: string | null
  pickedUpAt: string | null
  scannedBarcodes: string[]
  deliveredAt: string | null
  failureReason: string | null
  fee: number
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
  /** False when another courier has claimed this task: readable, not actionable. */
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
  mine: Delivery[]
  history: Delivery[]
}

export interface CreateDeliveryInput {
  bookingId: string
  address: string
  notes?: string
  contactPhone?: string
  origin: DeliveryOrigin
  fee?: number
}

export interface DeliveryTransitionPayload {
  confirmCourierId?: string
  compartmentCode?: string
  scannedBarcodes?: string[]
  reason?: string
  note?: string
}

export const deliveryApi = {
  create: (input: CreateDeliveryInput) => unwrap<Delivery>(http.post('/deliveries', input)),
  station: (params?: { status?: string; bookingId?: string }) =>
    unwrap<Delivery[]>(http.get('/deliveries/station', { params })),
  stationTransition: (id: string, code: string, payload?: DeliveryTransitionPayload) =>
    unwrap<Delivery>(http.post(`/deliveries/station/${id}/transition`, { code, payload })),

  board: () => unwrap<CourierBoard>(http.get('/deliveries/courier/board')),
  courierTransition: (id: string, code: string, payload?: DeliveryTransitionPayload) =>
    unwrap<Delivery>(http.post(`/deliveries/courier/${id}/transition`, { code, payload })),

  detail: (id: string) => unwrap<DeliveryDetail>(http.get(`/deliveries/${id}`)),
}
