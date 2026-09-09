export const ROLES = [
  'AGENT',
  'DELIVERY_AGENT',
  'SUPERVISOR',
  'CHIEF_CAPTAIN',
  'MANAGER',
  'PROJECT_MANAGER',
  'HR',
  'ACCOUNTANT',
  'TENANT_ADMIN',
] as const
export type Role = (typeof ROLES)[number]

export const ENGINE_KINDS = [
  'SHOP_AND_DROP',
  'MOBILITY',
  'LAGOON',
  'COTE_RESTAURANT',
  'ANAAM',
] as const
export type EngineKind = (typeof ENGINE_KINDS)[number]

export type SessionKind = 'STORAGE' | 'RENTAL' | 'ACTIVITY' | 'EXPERIENCE' | 'DINING'

export const BILLING_MODELS = ['PER_BAG', 'PER_COMPARTMENT', 'PACKAGE', 'DURATION_BASED'] as const
export type BillingModel = (typeof BILLING_MODELS)[number]

/**
 * How each activity is allowed to charge. A lagoon trip is sold as a trip — a captain takes the
 * boat out and brings it back, so there is no period to bill and no bags to count.
 */
export const BILLING_FOR: Record<EngineKind, BillingModel[]> = {
  SHOP_AND_DROP: ['PER_BAG', 'PER_COMPARTMENT', 'PACKAGE', 'DURATION_BASED'],
  MOBILITY: ['DURATION_BASED', 'PACKAGE'],
  LAGOON: ['PACKAGE'],
  COTE_RESTAURANT: ['PACKAGE', 'PER_BAG'],
  ANAAM: ['PACKAGE', 'DURATION_BASED'],
}

export function billingAllowedFor(engineKind: EngineKind): BillingModel[] {
  return BILLING_FOR[engineKind] ?? [...BILLING_MODELS]
}

export const DURATION_UNITS = ['HOUR', 'DAY', 'HALF_HOUR', 'FIFTEEN_MIN'] as const
export type DurationUnit = (typeof DURATION_UNITS)[number]

export const SALE_TYPES = ['RENTAL', 'SALE'] as const
export type SaleType = (typeof SALE_TYPES)[number]

export const SALE_UNITS = ['HOUR', 'FULL_DAY', 'TOUR', 'BAG', 'CART', 'DELIVERY', 'ITEM'] as const
export type SaleUnit = (typeof SALE_UNITS)[number]

/**
 * What each activity is sold by. A boat trip is sold as a trip: there are no hours on the water to
 * count and no bags to price, so offering them would only invite a mistake.
 */
export const SALE_UNITS_FOR: Record<EngineKind, SaleUnit[]> = {
  SHOP_AND_DROP: ['BAG', 'CART', 'DELIVERY', 'ITEM', 'HOUR', 'FULL_DAY'],
  MOBILITY: ['HOUR', 'FULL_DAY', 'TOUR', 'ITEM'],
  LAGOON: ['TOUR'],
  COTE_RESTAURANT: ['ITEM'],
  ANAAM: ['TOUR', 'ITEM'],
}

export function saleUnitsFor(engineKind: EngineKind): SaleUnit[] {
  return SALE_UNITS_FOR[engineKind] ?? [...SALE_UNITS]
}

/** Whether time is charged for at all. A trip has a captain, not a meter. */
export function chargesForTime(engineKind: EngineKind): boolean {
  return billingAllowedFor(engineKind).includes('DURATION_BASED')
}
export type BagCategory = 'SOFT' | 'HARD' | 'OVERSIZE' | 'FRAGILE'

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

export type BagItemStatus = 'REGISTERED' | 'LABELLED' | 'STORED' | 'IN_TRANSIT' | 'RETRIEVED' | 'DELIVERED'
export type CustodyHolder = 'CUSTOMER' | 'AGENT' | 'LOCKER' | 'PORTER'

export const VERIFICATION_PURPOSES = ['RETRIEVAL', 'DEPOSIT_REFUND', 'DELIVERY_REQUEST'] as const
export type VerificationPurpose = (typeof VERIFICATION_PURPOSES)[number]

export const VERIFICATION_METHODS = ['WHATSAPP_OTP', 'EMAIL_OTP', 'ID_DOCUMENT', 'MANAGER_OVERRIDE'] as const
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]

export const ID_DOCUMENT_TYPES = ['NATIONAL_ID', 'IQAMA', 'PASSPORT', 'DRIVING_LICENCE'] as const
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number]

export type VerificationStatus = 'VERIFIED' | 'CONSUMED'
export const PAYMENT_METHODS = ['CASH', 'CARD'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export type PaymentKind = 'SALE' | 'DEPOSIT' | 'REFUND' | 'DAMAGE_CHARGE' | 'OVERTIME'
export type { IncidentType } from './incidents.js'

export interface Money {
  amount: number
  currency: string
}

export interface TenantBranding {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  logoText: string
}
