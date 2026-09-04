import i18n from '@/i18n'
import { http, unwrap } from './client'
import type { EngineKind, Role } from './types'

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

const ENGLISH_CATEGORIES: Record<ExpenseCategory, string> = {
  SUPPLIER: 'Supplier / purchase',
  MAINTENANCE: 'Maintenance',
  REPAIR: 'Repair',
  FUEL_OIL: 'Fuel & oil',
  RENT_VENUE: 'Venue rent',
  RENT_ACCOMMODATION: 'Accommodation rent',
  PAYROLL: 'Payroll',
  ADMIN: 'Administrative',
  BANK_COMMISSION: 'Bank commission',
  OTHER: 'Other',
}

export const categoryLabel = (category: ExpenseCategory | string): string =>
  i18n.t(`status:expenseCategory.${category}`, {
    defaultValue: ENGLISH_CATEGORIES[category as ExpenseCategory] ?? String(category).replaceAll('_', ' '),
  })

export const SYSTEM_CATEGORIES: ExpenseCategory[] = ['BANK_COMMISSION']

export const ENTERABLE_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => !SYSTEM_CATEGORIES.includes(c))

export interface Expense {
  _id: string
  category: ExpenseCategory
  description: string
  supplier: string
  reference: string
  engineKind: EngineKind | null
  seasonId: string | null
  seasonName: string | null
  amount: number
  baseAmount: number
  vatAmount: number
  vatRate: number
  incurredAt: string
  status: 'RECORDED' | 'VOID'
  voidReason: string | null
  enteredBy: string
  enteredByName: string
}

export interface HrOverview {
  totals: { count: number; base: number; vat: number; total: number; voided: number }
  byCategory: { category: ExpenseCategory; count: number; base: number; vat: number; total: number }[]
  byActivity: { engineKind: EngineKind; count: number; base: number; total: number }[]
  unassigned: { count: number; base: number }
}

export interface Season {
  _id: string
  name: string
  startsAt: string
  endsAt: string
  active: boolean
  expenseCount: number
  expenseBase: number
  payrollCount: number
  payrollBase: number
}

export interface SeasonEmployee {
  userId: string
  fullName: string
  role: Role
  active: boolean
  charged: boolean
  expenseId: string | null
  amount: number
  monthly: number
}

export interface SeasonDetail extends Season {
  months: number
  expenseVat: number
  chargeable: number
  uncharged: number
  employees: SeasonEmployee[]
  costs: Expense[]
  byCategory: { category: ExpenseCategory; count: number; base: number }[]
  voided: number
}

export interface PayrollResult {
  seasonId: string
  seasonName: string
  months: number
  charged: number
  skipped: number
  alreadyCharged: number
  noRateGiven: number
  people: { name: string; amount: number }[]
  totalBase: number
}

export interface ExpenseInput {
  category: ExpenseCategory
  description: string
  supplier?: string
  reference?: string
  engineKind?: EngineKind | null
  seasonId?: string | null
  amount: number
  incurredAt?: string
}

export interface HrFilter {
  from?: string
  to?: string
  category?: ExpenseCategory
  engineKind?: EngineKind
  seasonId?: string
}

export interface ShiftWindow {
  startsAt: string
  endsAt: string
  lengthMin: number
}

export interface HoursRow {
  agentId: string
  name: string
  role: Role | null
  shifts: number
  stillOpen: number
  minutes: number
  hours: number
  expectedHours: number
  lastSeen: string | null
}

export interface HoursWorked {
  from: string
  to: string
  window: ShiftWindow
  rows: HoursRow[]
  totalHours: number
}

export interface PeopleAuditRow {
  _id: string
  action: string
  entity: string
  entityId: string
  detail: string | null
  reason: string | null
  actorId: string
  actorName: string
  at: string
}

export const hrApi = {
  shiftWindow: () => unwrap<ShiftWindow>(http.get('/hr/shift-window')),
  setShiftWindow: (input: { startsAt: string; endsAt: string }) =>
    unwrap<ShiftWindow>(http.patch('/hr/shift-window', input)),
  hours: (params: { from?: string; to?: string } = {}) => unwrap<HoursWorked>(http.get('/hr/hours', { params })),
  peopleAudit: (params: { action?: string; agentId?: string } = {}) =>
    unwrap<{ actions: string[]; rows: PeopleAuditRow[] }>(http.get('/hr/audit', { params })),
  overview: (params: HrFilter = {}) => unwrap<HrOverview>(http.get('/hr/overview', { params })),
  expenses: (params: HrFilter = {}) => unwrap<Expense[]>(http.get('/hr/expenses', { params })),
  createExpense: (input: ExpenseInput) => unwrap<Expense>(http.post('/hr/expenses', input)),
  voidExpense: (id: string, reason: string) => unwrap<Expense>(http.post(`/hr/expenses/${id}/void`, { reason })),
  seasons: () => unwrap<Season[]>(http.get('/hr/seasons')),
  season: (id: string) => unwrap<SeasonDetail>(http.get(`/hr/seasons/${id}`)),
  createSeason: (input: { name: string; startsAt: string; endsAt: string }) =>
    unwrap<Season>(http.post('/hr/seasons', input)),
  chargePayroll: (input: { seasonId: string; months?: number; monthlyCostByRole: Partial<Record<Role, number>> }) =>
    unwrap<PayrollResult>(http.post('/hr/seasons/payroll', input)),
}
