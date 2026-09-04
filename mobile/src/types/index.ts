
export type Role =
  | 'AGENT'
  | 'DELIVERY_AGENT'
  | 'SUPERVISOR'
  | 'LAGOON_WELCOME'
  | 'CHIEF_CAPTAIN'
  | 'MANAGER'
  | 'PROJECT_MANAGER'
  | 'HR'
  | 'ACCOUNTANT'
  | 'TENANT_ADMIN'

export type EngineKind = 'SHOP_AND_DROP' | 'MOBILITY' | 'LAGOON' | 'COTE_RESTAURANT' | 'ANAAM'

export type BookingStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'RESERVED'
  | 'ACTIVE'
  | 'OVERTIME'
  | 'RETRIEVAL_IN_PROGRESS'
  | 'PREPARING'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'

export type BagStatus = 'REGISTERED' | 'LABELLED' | 'STORED' | 'IN_TRANSIT' | 'RETRIEVED' | 'DELIVERED'

export type PaymentMethod = 'CASH' | 'CARD' | 'APPLE_PAY' | 'TRANSFER'
export type CardScheme = 'MADA' | 'SPAN' | 'VISA' | 'MASTERCARD' | 'GCC'
export type OtpChannel = 'WHATSAPP' | 'EMAIL'
export type VerificationPurpose = 'RETRIEVAL' | 'DEPOSIT_REFUND' | 'DELIVERY_REQUEST'
export type IdDocumentType = 'NATIONAL_ID' | 'IQAMA' | 'PASSPORT' | 'DRIVING_LICENCE'

export interface Me {
  id: string
  email: string
  fullName: string
  role: Role
  phone: string
  engineKinds: EngineKind[]
  tenant: { id: string; name: string; branding?: Record<string, string> } | null
  station: { id: string; name: string } | null
  kiosk?: { id: string; name: string } | null
}

export interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  bookingCount?: number
  lastSeenAt?: string | null
}

export interface Product {
  _id: string
  name: string
  engineKind: EngineKind
  category: string
  basePrice: number
  depositRequired: number
  overtimeHourlyRate: number | null
  assetTypeId: string | null
  billingModel: string
  durationUnit?: string | null
  emoji: string
  active: boolean
}

export interface BagItem {
  index: number
  description: string
  barcode: string
  status: BagStatus
  category?: string
  weight?: number
}

export interface Session {
  kind: string
  status: BookingStatus
  assetUnitId?: string | null
  requestedDurationMin: number
  startedAt?: string | null
  expectedEndAt?: string | null
  gracePeriodMin: number
  overtimeHourlyRate: number
  remainingMs: number | null
  isOvertime: boolean
}

export interface CustodyEvent {
  from: string
  to: string
  at: string
  note?: string
}

export interface IdentityVerification {
  method: string
  purpose: VerificationPurpose
  status: string
  verifiedAt: string
  verifiedByRole: string
  expiresAt: string
  reason?: string
  document?: { type: string; last4: string; holderName: string }
}

export interface Booking {
  id: string
  _id: string
  ref: string
  trackingToken: string
  stationId: string
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  engineKind: EngineKind
  productName: string
  status: BookingStatus
  bags: BagItem[]
  session: Session
  reservation: { assetUnitId: string; expiresAt: string; status: string } | null
  assetUnitId: string | null
  packingPlan: {
    numberOfCompartmentsRequired: number
    suggestedAssetTypeId: string
    priceCalculationSummary: string
  } | null
  custody: CustodyEvent[]
  verifications: IdentityVerification[]
  metadata: Record<string, unknown>
  createdAt: string
}

export interface OrderLine {
  name: string
  quantity: number
  unitPrice: number
  isDeposit?: boolean
}

export interface Order {
  _id: string
  bookingId: string
  status: string
  lines: OrderLine[]
  subtotal: number
  vat: number
  total: number
  amountPaid: number
  balanceDue: number
}

export interface AvailableTransition {
  code: string
  label: string
  target: string
  style?: { backgroundColor: string }
}

export interface AssetUnit {
  _id: string
  identifier: string
  status: string
  assetTypeId: string
  stationId: string
  kioskId: string | null
  currentBookingId: string | null
}

export interface AssetTypeLite {
  _id: string
  name: string
  kind: string
  engineKind: EngineKind
}

export interface PackingSuggestion {
  assetTypeId: string
  assetTypeName: string
  numberOfCompartmentsRequired: number
  fitScore: number
  recommended: boolean
  priceCalculationSummary: string
  unitPrice?: number
  totalPrice?: number
}

export interface PackingSuggestResponse {
  requiredCapacityScore: number
  suggestions: PackingSuggestion[]
}

export interface DashboardStats {
  todaysTransactions: number
  todaysRevenue: number
  activeOperations: number
  storedBags: number
  dueSoon: number
  overdue: number
  pendingRetrievals: number
  openIncidents: number
  byEngine: { engineKind: EngineKind; count: number }[]
}

export interface Shift {
  _id: string
  status: string
  openedAt: string
  closedAt?: string | null
  expectedCash: number
  countedCash: number | null
  variance: number | null
  note?: string
}

export type IncidentStatus = 'REPORTED' | 'INVESTIGATING' | 'AWAITING_APPROVAL' | 'RESOLVED' | 'REJECTED'

export interface Incident {
  _id: string
  ref: string
  type: string
  description: string
  status: IncidentStatus
  engineKind: EngineKind | null
  bookingId: string | null
  createdAt: string
}

export interface IncidentCatalogue {
  byEngine: Record<string, string[]>
  labels: Record<string, string>
}

export type DeliveryStatus =
  | 'REQUESTED'
  | 'ASSIGNED'
  | 'RELEASE_REQUESTED'
  | 'RELEASE_APPROVED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'

export interface Delivery {
  _id: string
  bookingId: string
  bookingRef: string
  customerName: string
  customerPhone: string
  destination: { address: string; notes: string; contactPhone: string }
  status: DeliveryStatus
  origin: 'AT_STORAGE' | 'CUSTOMER_CONTACT'
  assignedTo: string | null
  assignedToName?: string | null
  requestedAt: string
  compartmentCode: string | null
  compartmentCodeExpiresAt: string | null
  assetUnitIdentifier: string | null
  scannedBarcodes: string[]
  deliveredAt: string | null
  failureReason: string | null
  fee: number
  updatedAt: string
}

export interface DeliveryDetail {
  delivery: Delivery
  bags: BagItem[]
  transitions: { code: string; label: string }[]
  mine?: boolean
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export interface ApiFailure {
  success: false
  statusCode: number
  message: string
  errors?: string[]
}
