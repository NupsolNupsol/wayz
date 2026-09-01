import mongoose, { Schema } from 'mongoose'
import type { EngineKind } from '../domain/types.js'

export const EXPENSE_CATEGORIES = [
  'SUPPLIER',
  'MAINTENANCE',
  'REPAIR',
  'FUEL_OIL',
  'RENT_VENUE',
  'RENT_ACCOMMODATION',
  'PAYROLL',
  'ADMIN',
  'BANK_COMMISSION',
  'OTHER',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const ADMIN_CATEGORIES: ExpenseCategory[] = ['PAYROLL', 'ADMIN']

export const SYSTEM_CATEGORIES: ExpenseCategory[] = ['BANK_COMMISSION']

export const EXPENSE_STATUSES = ['RECORDED', 'VOID'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

export interface ExpenseDoc {
  _id: string
  tenantId: string
  category: ExpenseCategory
  description: string
  supplier: string
  reference: string
  engineKind: EngineKind | null
  seasonId: string | null
  amount: number
  baseAmount: number
  vatAmount: number
  vatRate: number
  incurredAt: Date
  status: ExpenseStatus
  voidReason: string | null
  enteredBy: string
  createdAt: Date
  updatedAt: Date
}

const expenseSchema = new Schema<ExpenseDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    description: { type: String, required: true },
    supplier: { type: String, default: '' },
    reference: { type: String, default: '' },
    engineKind: { type: String, default: null, index: true },
    seasonId: { type: String, default: null, index: true },
    amount: { type: Number, required: true, min: 0 },
    baseAmount: { type: Number, required: true, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, required: true },
    incurredAt: { type: Date, required: true, index: true },
    status: { type: String, default: 'RECORDED', index: true },
    voidReason: { type: String, default: null },
    enteredBy: { type: String, required: true },
  },
  { _id: false, timestamps: true },
)

expenseSchema.index({ tenantId: 1, incurredAt: -1 })

export const Expense =
  (mongoose.models.Expense as mongoose.Model<ExpenseDoc>) ?? mongoose.model<ExpenseDoc>('Expense', expenseSchema)

export interface SeasonDoc {
  _id: string
  tenantId: string
  name: string
  startsAt: Date
  endsAt: Date
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const seasonSchema = new Schema<SeasonDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { _id: false, timestamps: true },
)

export const Season =
  (mongoose.models.Season as mongoose.Model<SeasonDoc>) ?? mongoose.model<SeasonDoc>('Season', seasonSchema)
