import type { EngineKind, Role } from '../domain/types.js'
import type { ExpenseCategory } from '../models/index.js'

export interface ExpenseInput {
  category: ExpenseCategory
  description: string
  supplier?: string
  reference?: string
  engineKind?: EngineKind | null
  seasonId?: string | null
  amount: number
  incurredAt?: string
  vatInclusive?: boolean
}

export interface ExpenseFilter {
  from?: string
  to?: string
  category?: ExpenseCategory
  engineKind?: EngineKind
  seasonId?: string
}

export interface SeasonInput {
  name: string
  startsAt: string
  endsAt: string
}

export interface PayrollInput {
  seasonId: string
  monthlyCostByRole: Partial<Record<Role, number>>
  months?: number
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

export type PayrollSkipReason = 'ALREADY_CHARGED' | 'NO_RATE_GIVEN'

export interface PayrollSkip {
  fullName: string
  role: Role
  reason: PayrollSkipReason
}
