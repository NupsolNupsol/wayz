import type { Role } from './access.js'
import type {
  AssetUnitStatus,
  BagItemStatus,
  BookingStatus,
  CustodyHolder,
  DeliveryOrigin,
  DeliveryStatus,
  ReservationStatus,
} from './status.js'

export const ENGINE_KINDS = ['SHOP_AND_DROP', 'MOBILITY', 'LAGOON', 'COTE_RESTAURANT', 'ANAAM'] as const
export type EngineKind = (typeof ENGINE_KINDS)[number]

export const ASSET_KINDS = ['COMPARTMENT', 'VEHICLE', 'BOAT', 'TABLE', 'ANIMAL'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export const ASSET_KIND_BY_ENGINE: Record<EngineKind, AssetKind> = {
  SHOP_AND_DROP: 'COMPARTMENT',
  MOBILITY: 'VEHICLE',
  LAGOON: 'BOAT',
  COTE_RESTAURANT: 'TABLE',
  ANAAM: 'ANIMAL',
}

export const ENGINE_BY_ASSET_KIND: Record<AssetKind, EngineKind> = Object.entries(ASSET_KIND_BY_ENGINE).reduce(
  (acc, [engine, kind]) => ({ ...acc, [kind]: engine as EngineKind }),
  {} as Record<AssetKind, EngineKind>,
)

export type SessionKind = 'STORAGE' | 'RENTAL' | 'ACTIVITY' | 'EXPERIENCE' | 'DINING'

export interface BagSnapshot {
  index: number
  barcode: string
  description: string
  status: BagItemStatus
  assignedUnitId?: string | null
}

export interface SessionSnapshot {
  kind: SessionKind
  status: BookingStatus
  assetUnitId?: string | null
  requestedDurationMin: number
  startedAt?: string | null
  expectedEndAt?: string | null
  chargeableEndedAt?: string | null
  gracePeriodMin: number
  overtimeHourlyRate: number
  paidAt?: string | null
}

export type TimerStart = 'FULFILMENT' | 'PAYMENT'

export interface TimerPolicy {
  startsOn: TimerStart
  startDelayMin: number
}

export interface WorkflowRules {
  timer: TimerPolicy
  replacementBonusMin: number
}

export interface ReservationSnapshot {
  assetUnitId: string
  expiresAt: string
  status: ReservationStatus
}

export interface VerificationSnapshot {
  purpose: string
  method: string
  status: 'VERIFIED' | 'CONSUMED'
  expiresAt: string
  consumedAt?: string | null
  reason?: string | null
}

export interface CustodySnapshot {
  from: CustodyHolder
  to: CustodyHolder
  at: string
  bagIndex?: number
  note?: string
}

export interface BookingSnapshot {
  _id: string
  ref: string
  engineKind: EngineKind
  status: BookingStatus
  bags: BagSnapshot[]
  session: SessionSnapshot
  reservation: ReservationSnapshot | null
  assetUnitId: string | null
  custody: CustodySnapshot[]
  verifications: VerificationSnapshot[]
  metadata: Record<string, unknown>
}

export interface AssetUnitSnapshot {
  _id: string
  identifier: string
  assetTypeId: string
  kind?: AssetKind
  status: AssetUnitStatus
  currentBookingId: string | null
}

export interface TransitionPayload {
  scannedUnitId?: string
  scannedBarcodes?: string[]
  unitId?: string
  reason?: string
  durationMin?: number
  inspectionDone?: boolean
  safetyAck?: boolean
  boardingVerified?: boolean
  [key: string]: unknown
}

export interface WorkflowContext {
  booking: BookingSnapshot
  payload: TransitionPayload
  actor: { id: string; role: Role }
  now: Date
  assets: {
    current: AssetUnitSnapshot | null
    available: AssetUnitSnapshot[]
    byId: Record<string, AssetUnitSnapshot>
  }
  rules?: WorkflowRules
}

export interface AssetIntent {
  op: 'SET_STATUS'
  unitId: string
  status: AssetUnitStatus
  currentBookingId?: string | null
  note?: string
}

export interface AuditIntent {
  action: string
  reason?: string
  detail?: string
}

export interface ValidationResult {
  errors: string[]
}

export interface OperationResult {
  errors: string[]
  booking: BookingSnapshot
  assetIntents: AssetIntent[]
  audits: AuditIntent[]
}

export interface TransitionStyle {
  backgroundColor: string
}

export interface Transition {
  code: string
  label: string
  source: BookingStatus[]
  target: BookingStatus
  actors: Role[]
  style?: TransitionStyle
}

export interface EngineWorkflow {
  engineKind: EngineKind
  assetKind: AssetKind
  sessionKind: SessionKind
  initialStatus: BookingStatus
  actors: Role[]
  transitions: Transition[]
}

export type WorkflowValidator = (transitionCode: string, ctx: WorkflowContext) => Promise<ValidationResult> | ValidationResult
export type WorkflowOperator = (transitionCode: string, ctx: WorkflowContext) => Promise<OperationResult> | OperationResult

export interface DeliveryDestination {
  address: string
  notes?: string
  contactPhone?: string
}

export interface DeliveryTimelineEntry {
  status: DeliveryStatus
  at: string
  by: string
  note?: string
}

export interface DeliverySnapshot {
  _id: string
  ref: string
  tenantId: string
  siteId: string
  stationId: string
  kioskId: string | null
  bookingId: string
  bookingRef: string
  customerId: string
  customerName: string
  customerPhone: string
  destination: DeliveryDestination
  status: DeliveryStatus
  origin: DeliveryOrigin
  verifiedBy: string | null
  verifiedAt: string | null
  requestedBy: string
  requestedAt: string
  assignedTo: string | null
  assignedAt: string | null
  releaseRequestedAt: string | null
  releaseApprovedBy: string | null
  releaseApprovedAt: string | null
  compartmentCode: string | null
  compartmentCodeExpiresAt: string | null
  pickedUpAt: string | null
  scannedBarcodes: string[]
  deliveredAt: string | null
  failureReason: string | null
  timeline: DeliveryTimelineEntry[]
}

export interface DeliveryBagRef {
  index: number
  barcode: string
  description: string
  status: string
}

export interface DeliveryContext {
  delivery: DeliverySnapshot
  bags: DeliveryBagRef[]
  payload: TransitionPayload
  actor: { id: string; role: Role }
  now: Date
}

export interface DeliveryOperationResult {
  errors: string[]
  delivery: DeliverySnapshot
  assetIntents: AssetIntent[]
  audits: AuditIntent[]
}

export interface DeliveryTransition {
  code: string
  label: string
  source: DeliveryStatus[]
  target: DeliveryStatus
  actors: Role[]
  style?: TransitionStyle
}

export interface DeliveryWorkflowDef {
  entity: 'DELIVERY'
  assetKind: AssetKind
  initialStatus: DeliveryStatus
  actors: Role[]
  transitions: DeliveryTransition[]
}

export type DeliveryValidator = (transitionCode: string, ctx: DeliveryContext) => Promise<ValidationResult> | ValidationResult
export type DeliveryOperator = (transitionCode: string, ctx: DeliveryContext) => Promise<DeliveryOperationResult> | DeliveryOperationResult
