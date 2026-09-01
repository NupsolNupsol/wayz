export const ROLES = ['AGENT', 'CASHIER', 'DELIVERY_AGENT', 'MANAGER', 'HR', 'ACCOUNTANT', 'TENANT_ADMIN'] as const
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

export const DURATION_UNITS = ['HOUR', 'DAY', 'HALF_HOUR', 'FIFTEEN_MIN'] as const
export type DurationUnit = (typeof DURATION_UNITS)[number]
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
