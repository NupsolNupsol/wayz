import mongoose, { Schema } from 'mongoose'
import type { EngineKind, TenantBranding } from '../domain/types.js'

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
  }
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
    verificationChannels: { type: [String], default: ['WHATSAPP', 'EMAIL'] },
  },
  { _id: false },
)

const tenantSchema = new Schema<TenantDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    legalName: { type: String, required: true },
    crNumber: { type: String, required: true },
    vatNumber: { type: String, required: true },
    enabledEngines: { type: [String], default: [] },
    branding: { type: brandingSchema, default: () => ({}) },
    vatRate: { type: Number, default: 0.15 },
    zakatRate: { type: Number, default: 0.025 },
    currency: { type: String, default: 'SAR' },
    company: { type: companySchema, default: () => ({}) },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { timestamps: true, _id: false },
)

export const Tenant = mongoose.model<TenantDoc>('Tenant', tenantSchema)
