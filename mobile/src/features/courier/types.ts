/**
 * The delivery contract, mirrored from the platform API.
 *
 * Kept in the feature rather than a shared `types/index.ts` so the courier domain owns its own
 * shapes: when the API changes, one folder changes with it.
 */

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

/** One kiosk on a run. A customer's bags can sit at more than one desk. */
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
  destination: { address: string; notes: string; contactPhone: string; kind?: string; kioskName?: string }
  status: DeliveryStatus
  origin: DeliveryOrigin
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
  amountDue?: number
  stops?: DeliveryStop[]
  activeStop?: DeliveryStop | null
  timeline: DeliveryTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export interface DeliveryBag {
  index: number
  barcode: string | null
  /** Present only when the site runs without real scanners, so the app can offer a tap-to-scan. */
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
  transitions: { code: string; label: string; target: DeliveryStatus }[]
}

export interface CourierBoard {
  available: Delivery[]
  mine: Delivery[]
  history: Delivery[]
}

export interface CourierTransitionPayload {
  scannedBarcodes?: string[]
  reason?: string
  note?: string
}
