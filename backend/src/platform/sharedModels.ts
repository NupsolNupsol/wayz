import type { Connection, Model, Schema } from 'mongoose'

import { scopeToOrganisation } from './orgScope.js'

import { AnimalTransferSchema } from '../models/animalTransfer.model.js'
import { AssetTypeSchema, AssetUnitSchema } from '../models/asset.model.js'
import { AuditSchema } from '../models/audit.model.js'
import { BookingSchema } from '../models/booking.model.js'
import { CardTransactionSchema, CommissionRateSchema } from '../models/cardTransaction.model.js'
import { CashMovementSchema } from '../models/cashMovement.model.js'
import { CatalogueProductSchema } from '../models/catalogue.model.js'
import { CounterSchema } from '../models/counter.model.js'
import { PlatformAdminSchema } from '../models/platformAdmin.model.js'
import { CustomerSchema } from '../models/customer.model.js'
import { DeliveryRequestSchema } from '../models/delivery.model.js'
import { ExpenseSchema, SeasonSchema } from '../models/expense.model.js'
import { IncidentSchema } from '../models/incident.model.js'
import { InvoiceDocSchema } from '../models/invoiceDoc.model.js'
import { ManualSaleSchema } from '../models/manualSale.model.js'
import { NotificationSchema } from '../models/notification.model.js'
import { OrderSchema } from '../models/order.model.js'
import { GateSchema, KioskSchema, SiteSchema, StationSchema, ZoneSchema } from '../models/org.model.js'
import { PaymentSchema } from '../models/payment.model.js'
import { PurchaseOrderSchema } from '../models/purchaseOrder.model.js'
import { ReceiptSchema } from '../models/receipt.model.js'
import { RefundRequestSchema } from '../models/refundRequest.model.js'
import { ShiftSchema } from '../models/shift.model.js'
import { TenantSchema } from '../models/tenant.model.js'
import { TripSchema } from '../models/trip.model.js'
import { UserSchema } from '../models/user.model.js'
import { VerificationEvidenceSchema } from '../models/verification.model.js'
import { VoucherCampaignSchema, VoucherSchema } from '../models/voucher.model.js'
import { LearningProgressSchema } from '../models/learningProgress.model.js'
import { VersionSchema } from '../models/version.model.js'

/**
 * Every collection the application owns, in one list.
 *
 * All of them live in one database and are separated by `tenantId` — the organisation a row
 * belongs to. Adding a collection here is what makes it part of the application, and is also
 * what enrols it in automatic organisation scoping below.
 */
export const SHARED_SCHEMAS = {
  AnimalTransfer: AnimalTransferSchema,
  AssetType: AssetTypeSchema,
  AssetUnit: AssetUnitSchema,
  Audit: AuditSchema,
  Booking: BookingSchema,
  CardTransaction: CardTransactionSchema,
  CommissionRate: CommissionRateSchema,
  CashMovement: CashMovementSchema,
  CatalogueProduct: CatalogueProductSchema,
  Counter: CounterSchema,
  PlatformAdmin: PlatformAdminSchema,
  Customer: CustomerSchema,
  DeliveryRequest: DeliveryRequestSchema,
  Expense: ExpenseSchema,
  Season: SeasonSchema,
  Incident: IncidentSchema,
  InvoiceDoc: InvoiceDocSchema,
  ManualSale: ManualSaleSchema,
  Notification: NotificationSchema,
  Order: OrderSchema,
  Site: SiteSchema,
  Zone: ZoneSchema,
  Station: StationSchema,
  Kiosk: KioskSchema,
  Gate: GateSchema,
  Payment: PaymentSchema,
  PurchaseOrder: PurchaseOrderSchema,
  Receipt: ReceiptSchema,
  RefundRequest: RefundRequestSchema,
  Shift: ShiftSchema,
  Tenant: TenantSchema,
  Trip: TripSchema,
  User: UserSchema,
  VerificationEvidence: VerificationEvidenceSchema,
  VoucherCampaign: VoucherCampaignSchema,
  Voucher: VoucherSchema,
  LearningProgress: LearningProgressSchema,
  Version: VersionSchema,
} as const

export type SharedModelName = keyof typeof SHARED_SCHEMAS

export type SharedModels = { [K in SharedModelName]: Model<any> }

/**
 * Collections that belong to the platform rather than to any one organisation.
 *
 * `Counter` issues the sequences behind booking and order references. Those are global by
 * design: two organisations must not be handed the same reference, and scoping the counter
 * per organisation is how that happens.
 */
const UNSCOPED: SharedModelName[] = [
  /*
   * The organisation itself.
   *
   * It *is* the organisation rather than belonging to one, so it is identified by `_id` and
   * carries no `tenantId` at all. Scoping it would filter on a field that does not exist and
   * quietly find nothing — which is how a signed-in user ends up with no company, no branding
   * and no adopted activities.
   */
  'Tenant',
  // Sequences behind booking and order references. Two organisations must not be handed the
  // same reference, so the counter is deliberately global.
  'Counter',
  // Release notes describe the product, not any one organisation, and are readable by all.
  'Version',
  /*
   * Whoever runs the platform.
   *
   * They create organisations, so they cannot belong to one — scoping this collection would
   * mean a platform administrator could only be found from inside an organisation that does
   * not exist yet. See `platformAdmin.model.ts` for why this is a separate identity at all.
   */
  'PlatformAdmin',
]

let bound: SharedModels | null = null

/**
 * Binds every schema onto the application connection, once.
 *
 * Scoping is installed here rather than in each model file so that no collection can join the
 * application without it: the list above is the enrolment, and there is no second path.
 */
export function modelsFor(conn: Connection): SharedModels {
  if (bound) return bound

  const models = {} as SharedModels
  for (const [name, schema] of Object.entries(SHARED_SCHEMAS) as [SharedModelName, Schema][]) {
    if (!UNSCOPED.includes(name)) {
      /*
       * A scoped collection must actually have somewhere to put the organisation.
       *
       * Mongoose runs schemas in strict mode, so a field the schema does not declare is
       * silently dropped on write. A collection enrolled in scoping without a `tenantId` path
       * therefore *looks* scoped and is not: every row is written unstamped and every scoped
       * read finds nothing. That is exactly what happened to `LearningProgress`, and it
       * surfaced as an onboarding tour thrown over every page rather than as anything that
       * looked like a scoping bug.
       *
       * Checked at binding rather than left to a test, because the failure is silent and the
       * cost of catching it here is one comparison per collection at boot.
       */
      if (!schema.path('tenantId')) {
        throw new Error(
          `Schema "${name}" is scoped per organisation but declares no tenantId field. ` +
            'Add one, or list it in UNSCOPED with a reason.',
        )
      }
      scopeToOrganisation(schema)
    }
    models[name] = conn.model(name, schema)
  }

  bound = models
  return models
}

/** Used by tests that rebuild the connection. */
export function forgetModels(): void {
  bound = null
}
