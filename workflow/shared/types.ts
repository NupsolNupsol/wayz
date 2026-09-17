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

/**
 * Every activity the platform implements.
 *
 * Each is a coded module — a workflow, a validator and an operator — not a configuration. An
 * organisation adopts the ones it runs; it does not invent them. Adding one here is the first
 * step of building it, and TypeScript will then name every map that has to account for it.
 */
export const ENGINE_KINDS = [
  // WAYZ
  'SHOP_AND_DROP',
  'MOBILITY',
  'LAGOON',
  'COTE_RESTAURANT',
  // WIQAR's Ana'am Experience — the seven packages of §4.1.
  'HORSE_RIDING',
  'EQUESTRIAN_LESSON',
  'CAMEL_TOUR',
  'ANIMAL_CARE',
  'ANIMAL_FEEDING',
  'PHOTOGRAPHY',
  'GROUP_PACKAGE',
] as const
export type EngineKind = (typeof ENGINE_KINDS)[number]

export const ASSET_KINDS = ['COMPARTMENT', 'VEHICLE', 'BOAT', 'TABLE', 'ANIMAL'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export const ASSET_KIND_BY_ENGINE: Record<EngineKind, AssetKind> = {
  SHOP_AND_DROP: 'COMPARTMENT',
  MOBILITY: 'VEHICLE',
  LAGOON: 'BOAT',
  COTE_RESTAURANT: 'TABLE',
  /*
   * Seven activities, one kind of resource.
   *
   * This map is deliberately many-to-one: a riding tour, a camel walk and a photo session all
   * work animals, and they are still three different activities with three different
   * workflows. Which is why there is no map back the other way — see below.
   */
  HORSE_RIDING: 'ANIMAL',
  EQUESTRIAN_LESSON: 'ANIMAL',
  CAMEL_TOUR: 'ANIMAL',
  ANIMAL_CARE: 'ANIMAL',
  ANIMAL_FEEDING: 'ANIMAL',
  PHOTOGRAPHY: 'ANIMAL',
  GROUP_PACKAGE: 'ANIMAL',
}

/*
 * There is deliberately no `ENGINE_BY_ASSET_KIND`.
 *
 * There used to be, built by inverting the map above, and it worked only while every activity
 * owned a distinct kind of resource. Seven WIQAR experiences share `ANIMAL`, so "which
 * activity does an animal belong to?" has seven answers and inverting the map would silently
 * return whichever happened to be last. Nothing consumed it; a question with no single answer
 * should not have a function that pretends otherwise.
 */

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
  /**
   * Minutes handed back after a faulty unit was swapped, totalled.
   *
   * The clock already moves when a replacement happens, but a moved clock does not explain
   * itself — an agent looking at "expected end 12:29" cannot tell it was 12:19 a minute
   * ago. This is what makes the compensation visible on the booking rather than only in
   * the audit trail.
   */
  replacementBonusMin?: number
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
  /** When a `RESTING` unit may work again (ISO). The session sweep returns it to service then. */
  restingUntil?: string | null
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

/**
 * Something the counter has to collect before an activity's booking can be confirmed.
 *
 * Declared by the activity module, beside the validator that enforces it, so the counter renders
 * exactly what the rules will ask for — no more, no less — and a new activity that needs a new
 * detail says so in its own file. An activity with nothing extra to collect declares nothing, and
 * its counter looks as it always has.
 */
export type IntakeField =
  /** The visitor's acceptance of the terms, recorded against them. */
  | { key: 'consent' }
  /** A named member of staff who will run the session. */
  | { key: 'trainer' }
  /** One of a fixed set of levels the session is taught at. */
  | { key: 'level'; options: string[] }
  /** How many people are in the party, and the smallest it may be. */
  | { key: 'partySize'; min: number }
  /** How many portions of feed are bought with the session. */
  | { key: 'feedPortions'; min: number }

export interface EngineWorkflow {
  engineKind: EngineKind
  assetKind: AssetKind
  sessionKind: SessionKind
  initialStatus: BookingStatus
  actors: Role[]
  transitions: Transition[]
  /** What confirmation needs from the counter. Absent means nothing beyond the sale itself. */
  intake?: IntakeField[]
}

export type WorkflowValidator = (transitionCode: string, ctx: WorkflowContext) => Promise<ValidationResult> | ValidationResult
export type WorkflowOperator = (transitionCode: string, ctx: WorkflowContext) => Promise<OperationResult> | OperationResult

export interface DeliveryDestination {
  /** GATE means an exit the customer collects from; ADDRESS is door-to-door. */
  kind?: 'ADDRESS' | 'GATE' | 'GATE_LOCKER'
  /** The gate a storage run carries bags to. Null on a run going the other way. */
  gateId?: string | null
  address: string
  kioskId?: string | null
  kioskName?: string
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
