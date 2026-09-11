import { Schema } from 'mongoose'

/**
 * The tenant registry — the control plane's record of who exists.
 *
 * This is the only place a tenant's database name is decided. Nothing a client sends
 * ever reaches database selection; a request carries a signed tenant id, that id is
 * looked up here, and the name written on this document is what gets opened.
 */

export const TENANT_LIFECYCLE = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'FAILED', 'ARCHIVED'] as const
export type TenantLifecycle = (typeof TENANT_LIFECYCLE)[number]

/**
 * Provisioning is a sequence of steps rather than one switch.
 *
 * Recorded individually so a run that dies halfway can be retried from where it stopped
 * instead of starting again on a half-built tenant.
 */
export const PROVISIONING_STEPS = ['DATABASE', 'INDEXES', 'PROFILES', 'ORG', 'ADMIN_USER', 'CATALOGUE'] as const
export type ProvisioningStep = (typeof PROVISIONING_STEPS)[number]

export interface TenantBrandingRecord {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoUrl: string | null
  logoText: string
  faviconUrl: string | null
  fontFamily: string
}

export interface TenantInvoiceIdentity {
  legalName: string
  legalNameAr: string
  tradingName: string
  crNumber: string
  vatNumber: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  postalCode: string
  country: string
  phone: string
  email: string
  invoicePrefix: string
  invoiceFooter: string
  invoiceFooterAr: string
}

export interface TenantRegistryDoc {
  _id: string
  /** The url-safe handle. Decides the database name and the tenant's login path. */
  slug: string
  name: string
  dbName: string
  lifecycle: TenantLifecycle
  branding: TenantBrandingRecord
  invoice: TenantInvoiceIdentity
  currency: string
  timezone: string
  locale: string
  secondaryLocale: string
  /** Capability keys this tenant may use. The frontend asks about these, never about names. */
  capabilities: string[]
  /** Profile keys enabled for this tenant. A tenant admin can only assign from this set. */
  enabledProfiles: string[]
  provisioning: {
    steps: { step: ProvisioningStep; status: 'PENDING' | 'DONE' | 'FAILED'; at: Date | null; error: string | null }[]
    lastError: string | null
    startedAt: Date | null
    completedAt: Date | null
  }
  suspendedReason: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const brandingSchema = new Schema<TenantBrandingRecord>(
  {
    primaryColor: { type: String, default: '#1a3470' },
    secondaryColor: { type: String, default: '#204897' },
    accentColor: { type: String, default: '#4f8ef7' },
    logoUrl: { type: String, default: null },
    logoText: { type: String, default: '' },
    faviconUrl: { type: String, default: null },
    fontFamily: { type: String, default: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  },
  { _id: false },
)

const invoiceSchema = new Schema<TenantInvoiceIdentity>(
  {
    legalName: { type: String, default: '' },
    legalNameAr: { type: String, default: '' },
    tradingName: { type: String, default: '' },
    crNumber: { type: String, default: '' },
    vatNumber: { type: String, default: '' },
    addressLine1: { type: String, default: '' },
    addressLine2: { type: String, default: '' },
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    country: { type: String, default: 'Saudi Arabia' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    invoicePrefix: { type: String, default: 'INV' },
    invoiceFooter: { type: String, default: '' },
    invoiceFooterAr: { type: String, default: '' },
  },
  { _id: false },
)

export const tenantRegistrySchema = new Schema<TenantRegistryDoc>(
  {
    _id: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    dbName: { type: String, required: true, unique: true },
    lifecycle: { type: String, enum: TENANT_LIFECYCLE, default: 'PROVISIONING', index: true },
    branding: { type: brandingSchema, default: () => ({}) },
    invoice: { type: invoiceSchema, default: () => ({}) },
    currency: { type: String, default: 'SAR' },
    timezone: { type: String, default: 'Asia/Riyadh' },
    locale: { type: String, default: 'en' },
    secondaryLocale: { type: String, default: 'ar' },
    capabilities: { type: [String], default: [] },
    enabledProfiles: { type: [String], default: [] },
    provisioning: {
      steps: {
        type: [
          new Schema(
            {
              step: { type: String, enum: PROVISIONING_STEPS, required: true },
              status: { type: String, enum: ['PENDING', 'DONE', 'FAILED'], default: 'PENDING' },
              at: { type: Date, default: null },
              error: { type: String, default: null },
            },
            { _id: false },
          ),
        ],
        default: [],
      },
      lastError: { type: String, default: null },
      startedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
    },
    suspendedReason: { type: String, default: null },
    createdBy: { type: String, default: '' },
  },
  { _id: false, timestamps: true },
)

export interface PlatformAdminDoc {
  _id: string
  email: string
  fullName: string
  passwordHash: string
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export const platformAdminSchema = new Schema<PlatformAdminDoc>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, required: true },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { _id: false, timestamps: true },
)

export interface PlatformAuditDoc {
  _id: string
  actorId: string
  actorEmail: string
  action: string
  tenantId: string | null
  detail: string
  before: unknown
  after: unknown
  at: Date
}

export const platformAuditSchema = new Schema<PlatformAuditDoc>(
  {
    _id: { type: String, required: true },
    actorId: { type: String, required: true, index: true },
    actorEmail: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    tenantId: { type: String, default: null, index: true },
    detail: { type: String, default: '' },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, default: () => new Date(), index: true },
  },
  { _id: false, versionKey: false },
)
