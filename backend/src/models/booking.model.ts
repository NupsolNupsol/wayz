import { Schema, type HydratedDocument } from 'mongoose'
import { nanoid } from 'nanoid'
import { DEFAULT_GRACE_MINUTES } from '../domain/overtime.js'
import type {
  BagCategory,
  BagItemStatus,
  BookingStatus,
  CustodyHolder,
  EngineKind,
  IdDocumentType,
  Role,
  SessionKind,
  VerificationMethod,
  VerificationPurpose,
  VerificationStatus,
} from '../domain/types.js'

export interface BagItem {
  index: number
  category: BagCategory
  description: string
  dimensions: { w: number; h: number; d: number }
  weight: number
  barcode: string
  status: BagItemStatus
  assignedUnitId?: string | null
}

export interface OperationalSession {
  kind: SessionKind
  status: BookingStatus
  assetUnitId?: string | null
  requestedDurationMin: number
  startedAt?: Date | null
  expectedEndAt?: Date | null
  chargeableEndedAt?: Date | null
  gracePeriodMin: number
  overtimeHourlyRate: number
  expiryWarningSentAt?: Date | null
  paidAt?: Date | null
  /** Minutes handed back after a faulty unit was swapped, totalled over every swap. */
  replacementBonusMin?: number
}

export interface AssetReservationEmbed {
  assetUnitId: string
  expiresAt: Date
  status: 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED'
}

export interface CustodyEvent {
  from: CustodyHolder
  to: CustodyHolder
  at: Date
  bagIndex?: number
  note?: string
}

export interface PackingPlanEmbed {
  requiredCapacityScore: number
  suggestedAssetTypeId: string
  numberOfCompartmentsRequired: number
  allocations: { compartmentIndex: number; bagIndexes: number[] }[]
  priceCalculationSummary: string
}

export interface IdentityVerification {
  purpose: VerificationPurpose
  method: VerificationMethod
  status: VerificationStatus
  channel?: 'WHATSAPP' | 'EMAIL' | 'MOCK' | null
  destination?: string | null
  phone?: string | null
  verifiedAt: Date
  verifiedBy: string
  verifiedByRole: Role
  expiresAt: Date
  consumedAt?: Date | null
  reason?: string | null
  document?: {
    type: IdDocumentType
    holderName: string
    last4: string
  } | null
  evidenceId?: string | null
}

export interface TransitionLogEntry {
  code: string
  from: BookingStatus
  to: BookingStatus
  by: string
  at: Date
  reason?: string
}

export interface BookingDoc {
  _id: string
  trackingToken: string
  ref: string
  tenantId: string
  stationId: string
  kioskId: string | null
  /**
   * The gate holding this booking's locker.
   *
   * Storage happens at a gate, not at the counter that sold it, so this is what says who can act
   * on the bags: the staff posted to that gate retrieve them, and the courier carrying them knows
   * where they are going. Set when a locker is allocated; null for anything that uses no locker.
   */
  gateId: string | null
  agentId: string
  orderId: string
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  engineKind: EngineKind
  productName: string
  /** The same name in Arabic, so an agent working in Arabic reads the sale in Arabic. */
  productNameAr?: string
  baseAmount: number
  vatAmount: number
  totalAmount: number
  vatRate: number
  status: BookingStatus
  bags: BagItem[]
  session: OperationalSession
  reservation: AssetReservationEmbed | null
  assetUnitId: string | null
  packingPlan: PackingPlanEmbed | null
  custody: CustodyEvent[]
  verifications: IdentityVerification[]
  discount?: BookingDiscount | null
  refunds: BookingRefund[]
  transitionLog: TransitionLogEntry[]
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

/**
 * Money the desk chose not to take. Kept on the booking rather than inferred from an order line so
 * it can be counted, filtered and reported on — the client asked to see these summed.
 */
export interface BookingDiscount {
  amount: number
  percent: number
  reasonCode: string
  reasonLabel: string
  note?: string
  /** Set when the discount came from a printed code rather than the desk's own judgement. */
  voucherCode?: string | null
  free: boolean
  givenBy: string
  givenByName: string
  at: Date
}

export interface BookingRefund {
  amount: number
  reason: string
  refundedBy: string
  refundedByName: string
  paymentIds: string[]
  at: Date
}

const discountSchema = new Schema<BookingDiscount>(
  {
    amount: { type: Number, required: true },
    percent: { type: Number, default: 0 },
    reasonCode: { type: String, required: true },
    reasonLabel: { type: String, default: '' },
    note: { type: String, default: '' },
    voucherCode: { type: String, default: null },
    free: { type: Boolean, default: false },
    givenBy: { type: String, required: true },
    givenByName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const refundSchema = new Schema<BookingRefund>(
  {
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    refundedBy: { type: String, required: true },
    refundedByName: { type: String, default: '' },
    paymentIds: { type: [String], default: [] },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const bagSchema = new Schema<BagItem>(
  {
    index: { type: Number, required: true },
    category: { type: String, default: 'SOFT' },
    description: { type: String, default: '' },
    dimensions: {
      w: { type: Number, default: 0 },
      h: { type: Number, default: 0 },
      d: { type: Number, default: 0 },
    },
    weight: { type: Number, default: 0 },
    barcode: { type: String, required: true },
    status: { type: String, default: 'REGISTERED' },
    assignedUnitId: { type: String, default: null },
  },
  { _id: false },
)

const sessionSchema = new Schema<OperationalSession>(
  {
    kind: { type: String, required: true },
    status: { type: String, default: 'CONFIRMED' },
    assetUnitId: { type: String, default: null },
    requestedDurationMin: { type: Number, default: 120 },
    startedAt: { type: Date, default: null },
    expectedEndAt: { type: Date, default: null },
    chargeableEndedAt: { type: Date, default: null },
    gracePeriodMin: { type: Number, default: DEFAULT_GRACE_MINUTES },
    overtimeHourlyRate: { type: Number, default: 0 },
    expiryWarningSentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    replacementBonusMin: { type: Number, default: 0 },
  },
  { _id: false },
)

const reservationSchema = new Schema<AssetReservationEmbed>(
  {
    assetUnitId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, default: 'ACTIVE' },
  },
  { _id: false },
)

const transitionLogSchema = new Schema<TransitionLogEntry>(
  {
    code: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    by: { type: String, required: true },
    at: { type: Date, default: Date.now },
    reason: { type: String },
  },
  { _id: false },
)

const custodySchema = new Schema<CustodyEvent>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now },
    bagIndex: { type: Number },
    note: { type: String },
  },
  { _id: false },
)

const verificationSchema = new Schema<IdentityVerification>(
  {
    purpose: { type: String, required: true },
    method: { type: String, required: true },
    status: { type: String, default: 'VERIFIED' },
    channel: { type: String, default: null },
    destination: { type: String, default: null },
    phone: { type: String, default: null },
    verifiedAt: { type: Date, default: Date.now },
    verifiedBy: { type: String, required: true },
    verifiedByRole: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    reason: { type: String, default: null },
    document: {
      type: new Schema(
        {
          type: { type: String, required: true },
          holderName: { type: String, required: true },
          last4: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    evidenceId: { type: String, default: null },
  },
  { _id: false },
)

const bookingSchema = new Schema<BookingDoc>(
  {
    _id: { type: String, default: () => `bk_${nanoid(10)}` },
    trackingToken: { type: String, default: () => nanoid(16), index: true, unique: true, sparse: true },
    ref: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null, index: true },
    gateId: { type: String, default: null, index: true },
    agentId: { type: String, required: true },
    orderId: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    engineKind: { type: String, required: true },
    productName: { type: String, required: true },
    productNameAr: { type: String, default: '' },
    baseAmount: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
    status: { type: String, default: 'DRAFT', index: true },
    bags: { type: [bagSchema], default: [] },
    session: { type: sessionSchema, required: true },
    reservation: { type: reservationSchema, default: null },
    assetUnitId: { type: String, default: null },
    packingPlan: { type: Schema.Types.Mixed, default: null },
    custody: { type: [custodySchema], default: [] },
    verifications: { type: [verificationSchema], default: [] },
    discount: { type: discountSchema, default: null },
    refunds: { type: [refundSchema], default: [] },
    transitionLog: { type: [transitionLogSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false, timestamps: true },
)

/**
 * A tracking token has to outlive the session that made it.
 *
 * The link goes to a customer over WhatsApp and may be opened days later, with no account
 * and no token to say which tenant it belongs to. Registering it here means every booking
 * — however it was created — leaves a way back to its own database.
 */
bookingSchema.post('save', function (doc) {
  const token = (doc as { trackingToken?: string })?.trackingToken
  if (!token) return
  void (async () => {
    try {
      const [{ currentTenant }, { registerPublicToken }] = await Promise.all([
        import('../platform/tenantContext.js'),
        import('../platform/publicLinks.js'),
      ])
      const tenant = currentTenant()
      if (tenant) await registerPublicToken(token, tenant.tenantId)
    } catch {
      // A public link that cannot be registered is a link that will not open; it must
      // never be a reason the booking itself fails to save.
    }
  })()
})

export const BookingSchema = bookingSchema

export type BookingHydrated = HydratedDocument<BookingDoc>
