export type ID = string

export type Role =
  | 'AGENT'
  | 'DELIVERY_AGENT'
  | 'SUPERVISOR'
  | 'CHIEF_CAPTAIN'
  | 'MANAGER'
  | 'PROJECT_MANAGER'
  | 'HR'
  | 'ACCOUNTANT'
  | 'TENANT_ADMIN'

export type EngineKind =
  | 'SHOP_AND_DROP'
  | 'MOBILITY'
  | 'LAGOON'
  | 'COTE_RESTAURANT'
  | 'ANAAM'

export interface BusinessEngine {
  id: ID
  kind: EngineKind
  name: string
  icon: string
  tagline: string
}

export interface Tenant {
  id: ID
  name: string
  legalName: string
  crNumber: string
  vatNumber: string
  accentColor: string
  logoText: string
}
export interface Site {
  id: ID
  tenantId: ID
  name: string
  city: string
}
export interface Zone {
  id: ID
  siteId: ID
  name: string
}
export interface Station {
  id: ID
  siteId: ID
  zoneId: ID
  name: string
  engineIds: ID[]
}

export interface User {
  id: ID
  email: string
  password: string
  fullName: string
  role: Role
  tenantId: ID
  siteId: ID
  zoneId: ID | null
  stationId: ID
  engineIds: ID[]
  phone: string
}

export interface Customer {
  id: ID
  tenantId: ID
  name: string
  phone: string
  email?: string
  createdAt: number
  vatId?: string
}

export type BillingModel = 'PER_BAG' | 'PER_COMPARTMENT' | 'PACKAGE' | 'DURATION_BASED'
export type DurationUnit = 'HOUR' | 'DAY' | 'HALF_HOUR' | 'FIFTEEN_MIN'

export interface CatalogueProduct {
  id: ID
  tenantId: ID
  engineId: ID
  name: string
  category: string
  basePrice: number
  depositRequired: number
  assetTypeId: ID | null
  billingModel: BillingModel
  durationUnit?: DurationUnit
  proposedPolicy?: ProposedPolicy
  emoji: string
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

export type BagCategory = 'SOFT' | 'HARD' | 'OVERSIZE' | 'FRAGILE'

export interface AssetType {
  id: ID
  tenantId: ID
  engineId: ID
  name: string
  kind: 'COMPARTMENT' | 'VEHICLE' | 'TABLE' | 'BOAT' | 'ANIMAL'
  capacity: {
    internalDimensions?: { w: number; h: number; d: number }
    maxWeight?: number
    maxRecommendedBagCount?: number
    compatibleBagCategories?: BagCategory[]
    capacityScore: number
    accessibilityCharacteristics?: string[]
    seats?: number
  }
}

export type AssetUnitStatus =
  | 'AVAILABLE'
  | 'HELD'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'RETRIEVAL_PENDING'
  | 'INSPECTION_REQUIRED'
  | 'BLOCKED'
  | 'OUT_OF_SERVICE'
  | 'MAINTENANCE'

export interface AssetUnit {
  id: ID
  tenantId: ID
  stationId: ID
  assetAreaId: ID
  assetTypeId: ID
  identifier: string
  status: AssetUnitStatus
  currentBookingId?: ID | null
  note?: string
}

export type BagItemStatus =
  | 'REGISTERED'
  | 'LABELLED'
  | 'STORED'
  | 'IN_TRANSIT'
  | 'RETRIEVED'
  | 'DELIVERED'
export interface BagItem {
  id: ID
  bookingId: ID
  index: number
  category: BagCategory
  description: string
  dimensions: { w: number; h: number; d: number }
  weight: number
  barcode: string
  status: BagItemStatus
  assignedUnitId?: ID | null
}

export interface PackingPlan {
  id: ID
  orderId: ID
  requiredCapacityScore: number
  suggestedAssetTypeId: ID
  numberOfCompartmentsRequired: number
  allocations: { unitLabel: string; bagIndexes: number[] }[]
  priceCalculationSummary: string
}
export type ResourceHoldStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED'
export interface ResourceHold {
  id: ID
  orderId: ID
  assetTypeId: ID
  quantityRequired: number
  expiresAt: number
  status: ResourceHoldStatus
}
export type AssetReservationStatus = 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED'
export interface AssetReservation {
  id: ID
  bookingId: ID
  assetUnitId: ID
  expiresAt: number
  status: AssetReservationStatus
}

export type PaymentMethod = 'CASH' | 'CARD'
export type { CardScheme } from '@/config/cardSchemes'
export interface Payment {
  id: ID
  orderId: ID
  amount: number
  method: PaymentMethod
  kind: 'SALE' | 'DEPOSIT' | 'REFUND' | 'DAMAGE_CHARGE' | 'OVERTIME'
  status: 'PENDING' | 'CAPTURED' | 'REFUNDED'
  createdAt: number
}
export interface OrderLine {
  id: ID
  productId: ID
  name: string
  quantity: number
  unitPrice: number
  isDeposit: boolean
  taxable: boolean
}
export type OrderStatus = 'DRAFT' | 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED'
export interface Order {
  id: ID
  ref: string
  tenantId: ID
  stationId: ID
  agentId: ID
  customerId: ID
  engineId: ID
  lines: OrderLine[]
  status: OrderStatus
  subtotal: number
  vat: number
  depositTotal: number
  total: number
  createdAt: number
}

export type BookingStatus = 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
export type SessionKind = 'STORAGE' | 'RENTAL' | 'ACTIVITY' | 'EXPERIENCE' | 'DINING'
export type SessionStatus =
  | 'PENDING_FULFILMENT'
  | 'ACTIVE'
  | 'OVERTIME'
  | 'RETRIEVAL_IN_PROGRESS'
  | 'COMPLETED'
  | 'LATE_ESCALATION'

export interface OperationalSession {
  id: ID
  bookingId: ID
  kind: SessionKind
  status: SessionStatus
  assetUnitId?: ID | null
  requestedDurationMin: number
  startedAt?: number | null
  expectedEndAt?: number | null
  chargeableEndedAt?: number | null
  gracePeriodMin: number
}

export interface Booking {
  id: ID
  ref: string
  tenantId: ID
  stationId: ID
  agentId: ID
  orderId: ID
  customerId: ID
  engineId: ID
  engineKind: EngineKind
  productName: string
  status: BookingStatus
  createdAt: number
  bagIds: ID[]
  sessionId?: ID | null
  reservationId?: ID | null
  metadata?: Record<string, string | number | boolean>
}

export type CustodyHolder = 'CUSTOMER' | 'AGENT' | 'LOCKER' | 'PORTER'
export interface CustodyEvent {
  id: ID
  bookingId: ID
  bagIndex?: number
  from: CustodyHolder
  to: CustodyHolder
  at: number
  note?: string
}

export interface Receipt {
  id: ID
  ref: string
  orderId: ID
  bookingId: ID
  tenantId: ID
  createdAt: number
  kind: 'SALE' | 'FINAL'
  qrPayload: string
}

export type ShiftStatus = 'OPEN' | 'RECONCILING' | 'CLOSED'
export interface Shift {
  id: ID
  agentId: ID
  stationId: ID
  tenantId: ID
  openedAt: number
  closedAt?: number | null
  status: ShiftStatus
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
  | 'ACCESS_ISSUE'
  | 'DAMAGE_ON_RETURN'
export type IncidentStatus =
  | 'REPORTED'
  | 'INVESTIGATING'
  | 'AWAITING_APPROVAL'
  | 'RESOLVED'
  | 'REJECTED'
export interface Incident {
  id: ID
  ref: string
  tenantId: ID
  stationId: ID
  bookingId?: ID
  type: IncidentType
  status: IncidentStatus
  description: string
  createdAt: number
  reportedBy: ID
}

export interface Notification {
  id: ID
  tenantId: ID
  stationId: ID
  title: string
  body: string
  createdAt: number
  read: boolean
  level: 'info' | 'warning' | 'danger' | 'success'
}

export interface AuditEvent {
  id: ID
  tenantId: ID
  at: number
  actorId: ID
  action: string
  reason?: string
  detail?: string
}
