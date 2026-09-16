import { Schema } from 'mongoose'
import type { EngineKind, TenantBranding } from '../domain/types.js'
import type { PenaltyRule, RentalRulesPatch, TransferRules, ProcurementRules } from '../domain/rules.js'

export interface TenantDoc {
  _id: string
  name: string
  legalName: string
  crNumber: string
  vatNumber: string
  enabledEngines: EngineKind[]
  branding: TenantBranding
  vatRate: number
  zakatRate: number
  currency: string
  company: {
    address: string
    city: string
    country: string
    phone: string
    email: string
    website: string
  }
  settings: {
    timezone: string
    locale: string
    gracePeriodMin: number
    overtimeBlockMinutes: number
    expiryWarningMinutes: number
    paymentMethods: string[]
    verificationChannels: string[]
    autoPrintReceipt: boolean
  }
  rentalRules: RentalRulesPatch
  /** Who raises and who approves an animal transfer. See TransferRules — the spec conflicts. */
  transferRules?: Partial<TransferRules>
  /** Who approves a purchase order, and where "high-value" starts. See ProcurementRules. */
  procurementRules?: Partial<ProcurementRules>
  shiftWindow?: { startsAt?: string; endsAt?: string }
  discountReasons?: { code: string; label: string; labelAr?: string; maxPercent?: number; needsApproval?: boolean }[]
  penaltySchedule: PenaltyRule[]
  createdAt: Date
  updatedAt: Date
}

const brandingSchema = new Schema<TenantBranding>(
  {
    primaryColor: { type: String, default: '#1a3470' },
    secondaryColor: { type: String, default: '#204897' },
    accentColor: { type: String, default: '#4f8ef7' },
    fontFamily: { type: String, default: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
    logoText: { type: String, default: 'LF' },
  },
  { _id: false },
)

const companySchema = new Schema(
  {
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: 'Saudi Arabia' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  { _id: false },
)

const settingsSchema = new Schema(
  {
    timezone: { type: String, default: 'Asia/Riyadh' },
    locale: { type: String, default: 'en' },
    gracePeriodMin: { type: Number, default: 5 },
    overtimeBlockMinutes: { type: Number, default: 60 },
    expiryWarningMinutes: { type: Number, default: 15 },
    paymentMethods: { type: [String], default: ['CASH', 'CARD'] },
    verificationChannels: { type: [String], default: ['WHATSAPP', 'SMS', 'EMAIL'] },
    autoPrintReceipt: { type: Boolean, default: true },
  },
  { _id: false },
)

const penaltyRuleSchema = new Schema<PenaltyRule>(
  {
    code: { type: String, required: true },
    label: { type: String, required: true },
    amount: { type: Number, default: null },
    engineKind: { type: String, default: null },
  },
  { _id: false },
)

const tenantSchema = new Schema<TenantDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    /*
     * The registration details an invoice must carry.
     *
     * Not required *here*, because a company is set up before its paperwork exists — a
     * commercial registration and a VAT number arrive weeks after somebody decides to open.
     * Requiring them at creation meant the only way to add a company was to already have them.
     *
     * The requirement has moved to where it actually bites: `invoice.service.ts` refuses to
     * issue a tax invoice for a company that has not filled them in. That is the moment the
     * law cares about, and the refusal there says what is missing.
     */
    legalName: { type: String, default: '' },
    crNumber: { type: String, default: '' },
    vatNumber: { type: String, default: '' },
    enabledEngines: { type: [String], default: [] },
    branding: { type: brandingSchema, default: () => ({}) },
    vatRate: { type: Number, default: 0.15 },
    zakatRate: { type: Number, default: 0.025 },
    currency: { type: String, default: 'SAR' },
    company: { type: companySchema, default: () => ({}) },
    settings: { type: settingsSchema, default: () => ({}) },
    rentalRules: { type: Schema.Types.Mixed, default: () => ({}) },
    transferRules: { type: Schema.Types.Mixed, default: () => ({}) },
    procurementRules: { type: Schema.Types.Mixed, default: () => ({}) },
    shiftWindow: { type: Schema.Types.Mixed, default: () => ({}) },
    discountReasons: { type: Schema.Types.Mixed, default: () => [] },
    penaltySchedule: { type: [penaltyRuleSchema], default: () => [] },
  },
  { timestamps: true, _id: false },
)

export const TenantSchema = tenantSchema
