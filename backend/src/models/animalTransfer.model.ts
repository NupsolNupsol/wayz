import { Schema } from 'mongoose'

/**
 * Moving an animal from one location to another.
 *
 * §7.4 of the WIQAR specification. Not part of any experience — a transfer is not something a
 * visitor buys — so it is its own record with its own approval chain rather than a step inside
 * one of the seven activity workflows.
 *
 * The lifecycle the specification describes:
 *
 * ```
 * REQUESTED ──approve──▶ APPROVED ──depart──▶ IN_TRANSIT ──receive──▶ ARRIVED
 *     │                      │
 *     └────── reject ────────┴──────────────────────────▶ REJECTED / CANCELLED
 * ```
 *
 * Who may do each step is **configuration**, not code — §7.4 and §11.2 name four different
 * approving roles with no overlap. See `TransferRules` in `domain/rules.ts`.
 */

export type AnimalTransferStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'REJECTED'
  | 'CANCELLED'

/** One thing that happened to this transfer, and who did it. §7.4's "full transfer log". */
export interface TransferEvent {
  action: string
  by: string
  byName: string
  role: string
  at: Date
  note?: string
}

export interface AnimalTransferDoc {
  _id: string
  tenantId: string
  ref: string

  /** The animal being moved, and what it was called at the time. */
  animalId: string
  animalIdentifier: string

  /** §7.4: originating and destination location. */
  fromSiteId: string
  fromStationId: string
  toSiteId: string
  toStationId: string

  /** §7.4: the transport driver named on the order. */
  driverId: string | null
  driverName: string

  /** §7.4: expected departure and arrival times. */
  expectedDepartureAt: Date | null
  expectedArrivalAt: Date | null
  departedAt: Date | null
  arrivedAt: Date | null

  status: AnimalTransferStatus
  reason: string

  /** §7.4: "approver identity" is kept on the record, not only in the log. */
  requestedBy: string
  approvedBy: string | null
  approvedAt: Date | null

  /**
   * The status the animal returns to on arrival.
   *
   * §7.4: *"animal status changes to 'Available' (or Resting) at new location"*. Which of the
   * two is left to whoever confirms receipt, because the specification offers both without
   * saying when each applies — a long journey may well warrant rest.
   */
  arriveAs: 'AVAILABLE' | 'RESTING'

  log: TransferEvent[]
  createdAt: Date
  updatedAt: Date
}

const eventSchema = new Schema<TransferEvent>(
  {
    action: { type: String, required: true },
    by: { type: String, required: true },
    byName: { type: String, default: '' },
    role: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false },
)

export const AnimalTransferSchema = new Schema<AnimalTransferDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    ref: { type: String, required: true },

    animalId: { type: String, required: true, index: true },
    animalIdentifier: { type: String, default: '' },

    fromSiteId: { type: String, required: true },
    fromStationId: { type: String, required: true },
    toSiteId: { type: String, required: true, index: true },
    toStationId: { type: String, required: true },

    driverId: { type: String, default: null },
    driverName: { type: String, default: '' },

    expectedDepartureAt: { type: Date, default: null },
    expectedArrivalAt: { type: Date, default: null },
    departedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },

    status: { type: String, default: 'REQUESTED', index: true },
    reason: { type: String, default: '' },

    requestedBy: { type: String, required: true },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },

    arriveAs: { type: String, default: 'RESTING' },

    log: { type: [eventSchema], default: [] },
  },
  { _id: false, timestamps: true },
)

/*
 * An animal has at most one transfer in flight.
 *
 * Partial rather than plain: a completed transfer must not stop the same animal being moved
 * again next season, which a unique index on `animalId` alone would.
 */
AnimalTransferSchema.index(
  { tenantId: 1, animalId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['REQUESTED', 'APPROVED', 'IN_TRANSIT'] } } },
)
