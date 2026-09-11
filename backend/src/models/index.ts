import { tenantModel } from '../platform/tenantContext.js'

import type { TenantDoc } from './tenant.model.js'
import type { GateDoc, KioskDoc, SiteDoc, StationDoc, ZoneDoc } from './org.model.js'
import type { UserDoc } from './user.model.js'
import type { CustomerDoc } from './customer.model.js'
import type { CatalogueProductDoc } from './catalogue.model.js'
import type { AssetTypeDoc, AssetUnitDoc } from './asset.model.js'
import type { OrderDoc } from './order.model.js'
import type { BookingDoc } from './booking.model.js'
import type { PaymentDoc } from './payment.model.js'
import type { ReceiptDoc } from './receipt.model.js'
import type { ShiftDoc } from './shift.model.js'
import type { IncidentDoc } from './incident.model.js'
import type { AuditDoc } from './audit.model.js'
import type { NotificationDoc } from './notification.model.js'
import type { ManualSaleDoc } from './manualSale.model.js'
import type { RefundRequestDoc } from './refundRequest.model.js'
import type { InvoiceDocDoc } from './invoiceDoc.model.js'
import type { VerificationEvidenceDoc } from './verification.model.js'
import type { DeliveryRequestDoc } from './delivery.model.js'
import type { CounterDoc } from './counter.model.js'
import type { ExpenseDoc, SeasonDoc } from './expense.model.js'
import type { CardTransactionDoc, CommissionRateDoc } from './cardTransaction.model.js'
import type { CashMovementDoc } from './cashMovement.model.js'
import type { TripDoc } from './trip.model.js'
import type { VoucherCampaignDoc, VoucherDoc } from './voucher.model.js'

/**
 * The tenant's collections, as the rest of the backend sees them.
 *
 * These read like ordinary Mongoose models and are used like them, but each one resolves
 * to the model of whichever tenant the current unit of work belongs to. Services did not
 * have to change: `Booking.find(...)` still means "this tenant's bookings", it just now
 * means it against this tenant's own database rather than a shared one.
 *
 * Touching any of them outside a tenant context throws — see
 * `docs/platform/01-ARCHITECTURE.md` (AD-4).
 */
export const Tenant = tenantModel<TenantDoc>('Tenant')
export const Site = tenantModel<SiteDoc>('Site')
export const Zone = tenantModel<ZoneDoc>('Zone')
export const Station = tenantModel<StationDoc>('Station')
export const Kiosk = tenantModel<KioskDoc>('Kiosk')
export const Gate = tenantModel<GateDoc>('Gate')
export const User = tenantModel<UserDoc>('User')
export const Customer = tenantModel<CustomerDoc>('Customer')
export const CatalogueProduct = tenantModel<CatalogueProductDoc>('CatalogueProduct')
export const AssetType = tenantModel<AssetTypeDoc>('AssetType')
export const AssetUnit = tenantModel<AssetUnitDoc>('AssetUnit')
export const Order = tenantModel<OrderDoc>('Order')
export const Booking = tenantModel<BookingDoc>('Booking')
export const Payment = tenantModel<PaymentDoc>('Payment')
export const Receipt = tenantModel<ReceiptDoc>('Receipt')
export const Shift = tenantModel<ShiftDoc>('Shift')
export const Incident = tenantModel<IncidentDoc>('Incident')
export const Audit = tenantModel<AuditDoc>('Audit')
export const Notification = tenantModel<NotificationDoc>('Notification')
export const ManualSale = tenantModel<ManualSaleDoc>('ManualSale')
export const RefundRequest = tenantModel<RefundRequestDoc>('RefundRequest')
export const InvoiceDoc = tenantModel<InvoiceDocDoc>('InvoiceDoc')
export const VerificationEvidence = tenantModel<VerificationEvidenceDoc>('VerificationEvidence')
export const DeliveryRequest = tenantModel<DeliveryRequestDoc>('DeliveryRequest')
export const Counter = tenantModel<CounterDoc>('Counter')
export const Expense = tenantModel<ExpenseDoc>('Expense')
export const Season = tenantModel<SeasonDoc>('Season')
export const CardTransaction = tenantModel<CardTransactionDoc>('CardTransaction')
export const CommissionRate = tenantModel<CommissionRateDoc>('CommissionRate')
export const CashMovement = tenantModel<CashMovementDoc>('CashMovement')
export const Trip = tenantModel<TripDoc>('Trip')
export const Voucher = tenantModel<VoucherDoc>('Voucher')
export const VoucherCampaign = tenantModel<VoucherCampaignDoc>('VoucherCampaign')

// Helpers and constants that are plain functions/values, not collections.
export { hashPassword, newInviteToken, hashInviteToken, INVITE_TTL_HOURS } from './user.model.js'
export { NOTIFICATION_LEVELS } from './notification.model.js'
export { MANUAL_SALE_STATUSES } from './manualSale.model.js'
export { REFUND_REQUEST_STATUSES } from './refundRequest.model.js'
export { EXPENSE_CATEGORIES, ADMIN_CATEGORIES, SYSTEM_CATEGORIES, EXPENSE_STATUSES } from './expense.model.js'
export { TRANSACTION_SOURCES, TRANSACTION_STATUSES } from './cardTransaction.model.js'
export { CASH_MOVEMENT_KINDS, MOVEMENT_SIGN } from './cashMovement.model.js'
export { TRIP_STATUSES } from './trip.model.js'

export type { TenantDoc } from './tenant.model.js'
export type { SiteDoc, ZoneDoc, StationDoc, KioskDoc, GateDoc } from './org.model.js'
export type { UserDoc, UserInvite } from './user.model.js'
export type { CustomerDoc } from './customer.model.js'
export type { CatalogueProductDoc, ProposedPolicy } from './catalogue.model.js'
export type { AssetTypeDoc, AssetUnitDoc } from './asset.model.js'
export type { OrderDoc, OrderLine, ResourceHold } from './order.model.js'
export type { BookingDoc, BagItem, OperationalSession, CustodyEvent, IdentityVerification } from './booking.model.js'
export type { PaymentDoc } from './payment.model.js'
export type { ReceiptDoc } from './receipt.model.js'
export type { ShiftDoc } from './shift.model.js'
export type { IncidentDoc } from './incident.model.js'
export type { AuditDoc } from './audit.model.js'
export type { NotificationDoc, NotificationLevel } from './notification.model.js'
export type { ManualSaleDoc, ManualSaleStatus } from './manualSale.model.js'
export type { RefundRequestDoc, RefundRequestStatus } from './refundRequest.model.js'
export type { InvoiceDocDoc } from './invoiceDoc.model.js'
export type { VerificationEvidenceDoc } from './verification.model.js'
export type { DeliveryRequestDoc, DeliveryStopDoc, DeliveryTimelineEntryDoc } from './delivery.model.js'
export type { CounterDoc } from './counter.model.js'
export type { ExpenseDoc, SeasonDoc, ExpenseCategory, ExpenseStatus } from './expense.model.js'
export type { CardTransactionDoc, CommissionRateDoc, TransactionSource, TransactionStatus } from './cardTransaction.model.js'
export type { CashMovementDoc, CashMovementKind } from './cashMovement.model.js'
export type { TripDoc, TripStatus, TripPassenger, TripStop } from './trip.model.js'
export type { VersionDoc, VersionChange, VersionLink, VersionCheck, VersionIssue } from './version.model.js'
export type { VoucherDoc, VoucherCampaignDoc, VoucherStatus } from './voucher.model.js'
