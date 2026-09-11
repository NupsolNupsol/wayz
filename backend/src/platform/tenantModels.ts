import type { Connection, Model, Schema } from 'mongoose'

import { AssetTypeSchema, AssetUnitSchema } from '../models/asset.model.js'
import { AuditSchema } from '../models/audit.model.js'
import { BookingSchema } from '../models/booking.model.js'
import { CardTransactionSchema, CommissionRateSchema } from '../models/cardTransaction.model.js'
import { CashMovementSchema } from '../models/cashMovement.model.js'
import { CatalogueProductSchema } from '../models/catalogue.model.js'
import { CounterSchema } from '../models/counter.model.js'
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
import { ReceiptSchema } from '../models/receipt.model.js'
import { RefundRequestSchema } from '../models/refundRequest.model.js'
import { ShiftSchema } from '../models/shift.model.js'
import { TenantSchema } from '../models/tenant.model.js'
import { TripSchema } from '../models/trip.model.js'
import { UserSchema } from '../models/user.model.js'
import { VerificationEvidenceSchema } from '../models/verification.model.js'
import { VoucherCampaignSchema, VoucherSchema } from '../models/voucher.model.js'

/**
 * Every collection a tenant owns, in one list.
 *
 * This is the whole surface of a tenant's data. A new collection is added here and it is
 * automatically part of every tenant — including tenants provisioned before it existed,
 * because models are bound when a connection is first used rather than at import time.
 */
export const TENANT_SCHEMAS = {
  AssetType: AssetTypeSchema,
  AssetUnit: AssetUnitSchema,
  Audit: AuditSchema,
  Booking: BookingSchema,
  CardTransaction: CardTransactionSchema,
  CommissionRate: CommissionRateSchema,
  CashMovement: CashMovementSchema,
  CatalogueProduct: CatalogueProductSchema,
  Counter: CounterSchema,
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
  Receipt: ReceiptSchema,
  RefundRequest: RefundRequestSchema,
  Shift: ShiftSchema,
  Tenant: TenantSchema,
  Trip: TripSchema,
  User: UserSchema,
  VerificationEvidence: VerificationEvidenceSchema,
  VoucherCampaign: VoucherCampaignSchema,
  Voucher: VoucherSchema,
} as const

export type TenantModelName = keyof typeof TENANT_SCHEMAS

/** The models of one tenant, bound to that tenant's connection. */
export type TenantModels = { [K in TenantModelName]: Model<any> }

const byConnection = new WeakMap<Connection, TenantModels>()

/**
 * Binds every schema onto a connection, once.
 *
 * Mongoose keeps its own per-connection model cache, so re-binding would be harmless but
 * wasteful; the WeakMap means a closed connection's models are collectable with it.
 */
export function modelsFor(conn: Connection): TenantModels {
  const cached = byConnection.get(conn)
  if (cached) return cached

  const built = {} as TenantModels
  for (const [name, schema] of Object.entries(TENANT_SCHEMAS)) {
    built[name as TenantModelName] =
      (conn.models[name] as Model<any>) ?? conn.model(name, schema as Schema)
  }
  byConnection.set(conn, built)
  return built
}
