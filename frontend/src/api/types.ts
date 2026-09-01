export type Role = 'AGENT' | 'CASHIER' | 'DELIVERY_AGENT' | 'MANAGER' | 'HR' | 'ACCOUNTANT' | 'TENANT_ADMIN'
export type EngineKind = 'SHOP_AND_DROP' | 'MOBILITY' | 'LAGOON' | 'COTE_RESTAURANT' | 'ANAAM'
export type BillingModel = 'PER_BAG' | 'PER_COMPARTMENT' | 'PACKAGE' | 'DURATION_BASED'
export type BookingStatus = 'DRAFT' | 'CONFIRMED' | 'RESERVED' | 'ACTIVE' | 'OVERTIME' | 'RETRIEVAL_IN_PROGRESS' | 'PREPARING' | 'SERVED' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'CARD'
export type { CardScheme } from '@/config/cardSchemes'

export interface Branding {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  logoText: string
}

export interface Me {
  id: string
  email: string
  fullName: string
  role: Role
  phone: string
  /** The activities an agent is dedicated to; empty for every other role, which sees all. */
  engineKinds: EngineKind[]
  tenant: {
    id: string
    name: string
    legalName: string
    crNumber: string
    vatNumber: string
    currency: string
    vatRate: number
    enabledEngines: EngineKind[]
    branding: Branding
  } | null
  station: { id: string; name: string; engineKinds: EngineKind[]; siteId: string; zoneId: string | null } | null
}

export interface ProposedPolicy {
  minAge?: number | null
  licenseRequired?: boolean
  conditionInspection?: 'MANDATORY_PHOTO' | 'VISUAL' | 'SKIP' | 'MANDATORY'
  safetyAck?: boolean
  overtimeRule?: string
  returnLocation?: string
  damageRule?: string
  operatorRequirement?: string
}

export interface Product {
  _id: string
  tenantId: string
  engineKind: EngineKind
  name: string
  category: string
  basePrice: number
  depositRequired: number
  assetTypeId: string | null
  billingModel: BillingModel
  durationUnit?: string
  proposedPolicy?: ProposedPolicy
  emoji?: string
}

export interface Customer {
  _id: string
  tenantId: string
  name: string
  phone: string
  email?: string
  createdAt: string
}

export interface PackingSuggestion {
  productId: string
  productName: string
  assetTypeId: string
  assetTypeName: string
  capacityScore: number
  maxBagsPerCompartment: number | null
  numberOfCompartments: number
  availableUnits: number
  fits: boolean
}
export interface PackingSuggestResponse {
  recommendedProductId: string | null
  totalScore: number
  suggestions: PackingSuggestion[]
}

export interface AssetUnit {
  _id: string
  identifier: string
  status: string
  assetTypeId: string
  stationId: string
}

export interface AssetTypeLite {
  _id: string
  name: string
  kind: string
  engineKind: EngineKind
}

export interface BagItem {
  index: number
  category: string
  description: string
  dimensions: { w: number; h: number; d: number }
  weight: number
  barcode: string
  status: string
  assignedUnitId?: string | null
}

export type SessionPhase = 'NOT_STARTED' | 'RUNNING' | 'GRACE' | 'OVERTIME' | 'ENDED'

export interface OvertimeState {
  phase: SessionPhase
  evaluatedAt: string
  expectedEndAt: string | null
  graceEndsAt: string | null
  remainingMs: number | null
  graceRemainingMs: number | null
  overdueMs: number
  gracePeriodMin: number
  withinGrace: boolean
  isOvertime: boolean
  chargeableHours: number
  hourlyRate: number
  penaltyAmount: number
}

export interface Session {
  kind: string
  status: BookingStatus
  assetUnitId?: string | null
  requestedDurationMin: number
  startedAt?: string | null
  expectedEndAt?: string | null
  chargeableEndedAt?: string | null
  gracePeriodMin: number
  overtimeHourlyRate: number
  remainingMs: number | null
  isOvertime: boolean
  overtime: OvertimeState
}

export interface PublicTracking {
  ref: string
  status: BookingStatus
  productName: string
  brandName: string
  currency: string
  bags: { index: number; description: string; status: string }[]
  bagCount: number
  startedAt: string | null
  expectedEndAt: string | null
  graceEndsAt: string | null
  requestedDurationMin: number
  overtime: Omit<OvertimeState, 'evaluatedAt' | 'expectedEndAt' | 'graceEndsAt'>
}

export interface CustodyEvent {
  from: string
  to: string
  at: string
  bagIndex?: number
  note?: string
}

export type VerificationPurpose = 'RETRIEVAL' | 'DEPOSIT_REFUND' | 'DELIVERY_REQUEST'
export type VerificationMethod = 'WHATSAPP_OTP' | 'EMAIL_OTP' | 'ID_DOCUMENT' | 'SUPERVISOR_OVERRIDE'
export type IdDocumentType = 'NATIONAL_ID' | 'IQAMA' | 'PASSPORT' | 'DRIVING_LICENCE'
export type OtpChannel = 'WHATSAPP' | 'EMAIL'
export type OtpDelivery = 'WHATSAPP' | 'EMAIL' | 'MOCK' | 'FAILED'

export interface IdentityVerification {
  purpose: VerificationPurpose
  method: VerificationMethod
  status: 'VERIFIED' | 'CONSUMED'
  channel?: string | null
  destination?: string | null
  phone?: string | null
  verifiedAt: string
  verifiedBy: string
  verifiedByRole: Role
  expiresAt: string
  consumedAt?: string | null
  reason?: string | null
  document?: { type: IdDocumentType; holderName: string; last4: string } | null
  evidenceId?: string | null
}

export interface BookingRefund {
  amount: number
  reason: string
  refundedBy: string
  refundedByName: string
  paymentIds: string[]
  at: string
}

export interface Booking {
  id: string
  _id: string
  trackingToken: string
  ref: string
  tenantId: string
  stationId: string
  agentId: string
  orderId: string
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
    requiredCapacityScore: number
    suggestedAssetTypeId: string
    numberOfCompartmentsRequired: number
    allocations: { compartmentIndex: number; bagIndexes: number[] }[]
    priceCalculationSummary: string
  } | null
  custody: CustodyEvent[]
  verifications: IdentityVerification[]
  refunds: BookingRefund[]
  metadata: Record<string, unknown>
  createdAt: string
}

export interface OrderLine {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  isDeposit: boolean
  taxable: boolean
}
export interface Order {
  _id: string
  ref: string
  lines: OrderLine[]
  hold: { assetTypeId: string; quantityRequired: number; status: string } | null
  status: string
  subtotal: number
  vat: number
  depositTotal: number
  total: number
  createdAt: string
}

export interface Receipt {
  _id: string
  ref: string
  kind: string
  qrPayload: string
  createdAt: string
}

export interface AvailableTransition {
  code: string
  label: string
  from: string
  target: string
  style?: { backgroundColor: string }
}

export interface EngineWorkflow {
  engineKind: EngineKind
  sessionKind: string
  initialStatus: BookingStatus
  actors: Role[]
  transitions: { code: string; label: string; source: string[]; target: string; actors: Role[]; style?: { backgroundColor: string } }[]
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
  status: 'OPEN' | 'RECONCILING' | 'CLOSED'
  openedAt: string
  closedAt?: string | null
  expectedCash: number
  countedCash?: number | null
  variance?: number | null
  resolutionNote?: string
}

export type IncidentType =
  | 'MISSING_BAG'
  | 'DAMAGED_BAG'
  | 'WRONG_BAG'
  | 'LABEL_ISSUE'
  | 'DAMAGE_ON_RETURN'
  | 'ASSET_DAMAGE'
  | 'ASSET_FAULT'
  | 'ASSET_NOT_RETURNED'
  | 'LATE_RETURN'
  | 'CUSTOMER_INJURY'
  | 'SAFETY_CONCERN'
  | 'ANIMAL_WELFARE'
  | 'FOOD_QUALITY'
  | 'ORDER_ERROR'
  | 'ACCESS_ISSUE'
  | 'PAYMENT_DISPUTE'
  | 'OTHER'

export interface IncidentCatalogue {
  labels: Record<IncidentType, string>
  byEngine: Record<EngineKind, IncidentType[]>
  all: IncidentType[]
}

export interface Incident {
  _id: string
  ref: string
  type: IncidentType
  status: string
  description: string
  bookingId?: string | null
  engineKind?: EngineKind | null
  createdAt: string
}
