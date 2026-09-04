import {
  Audit,
  Expense,
  Season,
  Shift,
  Tenant,
  User,
  EXPENSE_CATEGORIES,
  SYSTEM_CATEGORIES,
  type ExpenseCategory,
} from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { nextId } from './counter.service.js'
import { DEFAULT_VAT_RATE, noVat, splitInclusive } from '../domain/tax.js'
import { isValidClock, resolveShiftWindow, shiftWindowMinutes } from '../domain/rules.js'
import { tenantRules } from './rules.service.js'
import { ENGINE_KINDS, type Role } from '../domain/types.js'
import type {
  ExpenseFilter,
  ExpenseInput,
  HrScope,
  PayrollInput,
  PayrollSkip,
  SeasonInput,
} from '../interfaces/index.js'

const PAYROLL_ROLES: Role[] = [
  'AGENT',
  'DELIVERY_AGENT',
  'CHIEF_CAPTAIN',
  'SUPERVISOR',
  'MANAGER',
]

const NO_VAT_CATEGORIES: ExpenseCategory[] = ['PAYROLL', ...SYSTEM_CATEGORIES]

const SYSTEM_OWNED =
  'The bank commission is posted from the card transactions, not entered or removed by hand.'

async function tenantRate(tenantId: string): Promise<number> {
  const tenant = await Tenant.findById(tenantId).lean()
  if (!tenant) throw ApiError.notFound('Tenant not found.')
  return tenant.vatRate ?? DEFAULT_VAT_RATE
}

export async function recordExpense(scope: HrScope, input: ExpenseInput) {
  if (!EXPENSE_CATEGORIES.includes(input.category)) throw ApiError.badRequest(`Unknown category "${input.category}".`)
  if (SYSTEM_CATEGORIES.includes(input.category)) throw ApiError.badRequest(SYSTEM_OWNED)
  const description = input.description?.trim() ?? ''
  if (description.length < 3) throw ApiError.badRequest('Describe what this cost is for.')
  const amount = round2(input.amount)
  if (!(amount > 0)) throw ApiError.badRequest('Enter an amount greater than zero.')
  if (input.engineKind && !ENGINE_KINDS.includes(input.engineKind)) {
    throw ApiError.badRequest(`Unknown activity "${input.engineKind}".`)
  }

  if (input.seasonId) {
    const season = await Season.findOne({ _id: input.seasonId, tenantId: scope.tenantId }).lean()
    if (!season) throw ApiError.badRequest('That season does not exist in this tenant.')
  }

  const rate = await tenantRate(scope.tenantId)
  const tax = NO_VAT_CATEGORIES.includes(input.category)
    ? noVat(amount)
    : input.vatInclusive === false
      ? { baseAmount: amount, vatAmount: round2(amount * rate), totalAmount: round2(amount * (1 + rate)), vatRate: rate }
      : splitInclusive(amount, rate)

  const expense = await Expense.create({
    _id: await nextId('expense'),
    tenantId: scope.tenantId,
    category: input.category,
    description,
    supplier: input.supplier?.trim() ?? '',
    reference: input.reference?.trim() ?? '',
    engineKind: input.engineKind ?? null,
    seasonId: input.seasonId ?? null,
    amount: tax.totalAmount,
    baseAmount: tax.baseAmount,
    vatAmount: tax.vatAmount,
    vatRate: tax.vatRate,
    incurredAt: input.incurredAt ? new Date(input.incurredAt) : new Date(),
    status: 'RECORDED',
    enteredBy: scope.userId,
  })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'EXPENSE_RECORDED',
    entity: 'Expense',
    entityId: expense._id,
    detail: `${input.category} · ${tax.totalAmount.toFixed(2)} · ${description}`,
  })

  return expense.toObject()
}

export async function voidExpense(scope: HrScope, id: string, reason: string) {
  const trimmed = reason?.trim() ?? ''
  if (trimmed.length < 3) throw ApiError.badRequest('Say why this cost is being voided.')

  const expense = await Expense.findOne({ _id: id, tenantId: scope.tenantId })
  if (!expense) throw ApiError.notFound('Expense not found.')
  if (SYSTEM_CATEGORIES.includes(expense.category)) throw ApiError.unprocessable(SYSTEM_OWNED)
  if (expense.status === 'VOID') throw ApiError.unprocessable('That cost is already void.')

  expense.status = 'VOID'
  expense.voidReason = trimmed
  await expense.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'EXPENSE_VOIDED',
    entity: 'Expense',
    entityId: expense._id,
    reason: trimmed,
    detail: expense.amount.toFixed(2),
  })

  return expense.toObject()
}

export async function listExpenses(scope: HrScope, filter: ExpenseFilter = {}) {
  const query: Record<string, unknown> = { tenantId: scope.tenantId }
  if (filter.category) query.category = filter.category
  if (filter.engineKind) query.engineKind = filter.engineKind
  if (filter.seasonId) query.seasonId = filter.seasonId
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {}
    if (filter.from) range.$gte = new Date(filter.from)
    if (filter.to) {
      const to = new Date(filter.to)
      to.setUTCHours(23, 59, 59, 999)
      range.$lte = to
    }
    query.incurredAt = range
  }

  const rows = await Expense.find(query).sort({ incurredAt: -1 }).limit(1000).lean()
  const [people, seasons] = await Promise.all([
    User.find({ tenantId: scope.tenantId }).lean(),
    Season.find({ tenantId: scope.tenantId }).lean(),
  ])
  const name = new Map(people.map((u) => [u._id, u.fullName]))
  const seasonName = new Map(seasons.map((s) => [s._id, s.name]))

  return rows.map((r) => ({
    ...r,
    enteredByName: name.get(r.enteredBy) ?? r.enteredBy,
    seasonName: r.seasonId ? (seasonName.get(r.seasonId) ?? r.seasonId) : null,
  }))
}

export async function hrOverview(scope: HrScope, filter: ExpenseFilter = {}) {
  const rows = await listExpenses(scope, filter)
  const live = rows.filter((r) => r.status === 'RECORDED')

  const byCategory = EXPENSE_CATEGORIES.map((category) => {
    const inCategory = live.filter((r) => r.category === category)
    return {
      category,
      count: inCategory.length,
      base: round2(inCategory.reduce((t, r) => t + r.baseAmount, 0)),
      vat: round2(inCategory.reduce((t, r) => t + r.vatAmount, 0)),
      total: round2(inCategory.reduce((t, r) => t + r.amount, 0)),
    }
  }).filter((c) => c.count > 0)

  const byActivity = ENGINE_KINDS.map((engineKind) => {
    const inActivity = live.filter((r) => r.engineKind === engineKind)
    return {
      engineKind,
      count: inActivity.length,
      base: round2(inActivity.reduce((t, r) => t + r.baseAmount, 0)),
      total: round2(inActivity.reduce((t, r) => t + r.amount, 0)),
    }
  }).filter((a) => a.count > 0)

  const unassigned = live.filter((r) => !r.engineKind)

  return {
    totals: {
      count: live.length,
      base: round2(live.reduce((t, r) => t + r.baseAmount, 0)),
      vat: round2(live.reduce((t, r) => t + r.vatAmount, 0)),
      total: round2(live.reduce((t, r) => t + r.amount, 0)),
      voided: rows.length - live.length,
    },
    byCategory,
    byActivity,
    unassigned: {
      count: unassigned.length,
      base: round2(unassigned.reduce((t, r) => t + r.baseAmount, 0)),
    },
  }
}

export async function listSeasons(scope: HrScope) {
  const seasons = await Season.find({ tenantId: scope.tenantId }).sort({ startsAt: -1 }).lean()
  const expenses = await Expense.find({ tenantId: scope.tenantId, status: 'RECORDED' }).lean()

  return seasons.map((s) => {
    const mine = expenses.filter((e) => e.seasonId === s._id)
    const payroll = mine.filter((e) => e.category === 'PAYROLL')
    return {
      ...s,
      expenseCount: mine.length,
      expenseBase: round2(mine.reduce((t, e) => t + e.baseAmount, 0)),
      payrollCount: payroll.length,
      payrollBase: round2(payroll.reduce((t, e) => t + e.baseAmount, 0)),
    }
  })
}

export function monthsBetween(startsAt: Date, endsAt: Date): number {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.44 * 86400000)))
}

export async function seasonDetail(scope: HrScope, seasonId: string) {
  const season = await Season.findOne({ _id: seasonId, tenantId: scope.tenantId }).lean()
  if (!season) throw ApiError.notFound('Season not found.')

  const [expenses, staff] = await Promise.all([
    Expense.find({ tenantId: scope.tenantId, seasonId: season._id }).sort({ incurredAt: -1 }).lean(),
    User.find({ tenantId: scope.tenantId }).lean(),
  ])

  const nameOf = new Map(staff.map((u) => [u._id, u.fullName]))
  const live = expenses.filter((e) => e.status === 'RECORDED')
  const payroll = live.filter((e) => e.category === 'PAYROLL')
  const chargeOf = new Map(payroll.map((e) => [e.reference, e]))
  const months = monthsBetween(season.startsAt, season.endsAt)

  const employees = staff
    .filter((u) => PAYROLL_ROLES.includes(u.role))
    .map((u) => {
      const charge = chargeOf.get(u._id)
      return {
        userId: u._id,
        fullName: u.fullName,
        role: u.role,
        active: u.active !== false,
        charged: !!charge,
        expenseId: charge?._id ?? null,
        amount: charge?.baseAmount ?? 0,
        monthly: charge ? round2(charge.baseAmount / months) : 0,
      }
    })
    .sort((a, b) => Number(b.charged) - Number(a.charged) || a.fullName.localeCompare(b.fullName))

  const costs = live
    .filter((e) => e.category !== 'PAYROLL')
    .map((e) => ({ ...e, enteredByName: nameOf.get(e.enteredBy) ?? e.enteredBy }))

  const byCategory = EXPENSE_CATEGORIES.map((category) => {
    const inCategory = live.filter((e) => e.category === category)
    return {
      category,
      count: inCategory.length,
      base: round2(inCategory.reduce((t, e) => t + e.baseAmount, 0)),
    }
  }).filter((c) => c.count > 0)

  return {
    ...season,
    months,
    expenseCount: live.length,
    expenseBase: round2(live.reduce((t, e) => t + e.baseAmount, 0)),
    expenseVat: round2(live.reduce((t, e) => t + e.vatAmount, 0)),
    payrollCount: payroll.length,
    payrollBase: round2(payroll.reduce((t, e) => t + e.baseAmount, 0)),
    chargeable: employees.filter((e) => e.active).length,
    uncharged: employees.filter((e) => e.active && !e.charged).length,
    employees,
    costs,
    byCategory,
    voided: expenses.length - live.length,
  }
}

export async function createSeason(scope: HrScope, input: SeasonInput) {
  const name = input.name?.trim() ?? ''
  if (name.length < 2) throw ApiError.badRequest('Give the season a name.')
  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(input.endsAt)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw ApiError.badRequest('Give the season a valid start and end date.')
  }
  if (endsAt <= startsAt) throw ApiError.badRequest('A season must end after it starts.')

  const season = await Season.create({
    _id: await nextId('season'),
    tenantId: scope.tenantId,
    name,
    startsAt,
    endsAt,
    active: true,
  })

  return season.toObject()
}

export async function chargeSeasonPayroll(scope: HrScope, input: PayrollInput) {
  const season = await Season.findOne({ _id: input.seasonId, tenantId: scope.tenantId }).lean()
  if (!season) throw ApiError.notFound('Season not found.')

  const months = input.months ?? 6
  if (!Number.isFinite(months) || months < 1 || months > 24) {
    throw ApiError.badRequest('A season charge covers between 1 and 24 months.')
  }

  const staff = await User.find({ tenantId: scope.tenantId, active: { $ne: false } }).lean()
  const chargeable = staff.filter((u) => PAYROLL_ROLES.includes(u.role))
  if (!chargeable.length) throw ApiError.unprocessable('There are no employees to charge for this season.')

  const already = await Expense.find({
    tenantId: scope.tenantId,
    seasonId: season._id,
    category: 'PAYROLL',
    status: 'RECORDED',
  }).lean()
  const chargedFor = new Set(already.map((e) => e.reference))

  const created = []
  const skipped: PayrollSkip[] = []
  for (const person of chargeable) {
    if (chargedFor.has(person._id)) {
      skipped.push({ fullName: person.fullName, role: person.role, reason: 'ALREADY_CHARGED' })
      continue
    }
    const monthly = input.monthlyCostByRole[person.role]
    if (!monthly || monthly <= 0) {
      skipped.push({ fullName: person.fullName, role: person.role, reason: 'NO_RATE_GIVEN' })
      continue
    }

    const total = round2(monthly * months)
    const expense = await Expense.create({
      _id: await nextId('expense'),
      tenantId: scope.tenantId,
      category: 'PAYROLL',
      description: `${person.fullName} — ${person.role.replaceAll('_', ' ').toLowerCase()} · ${season.name}`,
      supplier: '',
      reference: person._id,
      engineKind: null,
      seasonId: season._id,
      amount: total,
      baseAmount: total,
      vatAmount: 0,
      vatRate: 0,
      incurredAt: season.startsAt,
      status: 'RECORDED',
      enteredBy: scope.userId,
    })
    created.push(expense.toObject())
  }

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'SEASON_PAYROLL_CHARGED',
    entity: 'Season',
    entityId: season._id,
    detail: `${created.length} employee(s) · ${months} month(s)`,
  })

  return {
    seasonId: season._id,
    seasonName: season.name,
    months,
    charged: created.length,
    skipped: skipped.length,
    alreadyCharged: skipped.filter((s) => s.reason === 'ALREADY_CHARGED').length,
    noRateGiven: skipped.filter((s) => s.reason === 'NO_RATE_GIVEN').length,
    people: created.map((e) => ({ name: e.description.split(' — ')[0], amount: e.baseAmount })),
    totalBase: round2(created.reduce((t, e) => t + e.baseAmount, 0)),
  }
}

export async function hrShiftWindow(scope: HrScope) {
  const rules = await tenantRules(scope.tenantId)
  return { ...rules.shiftWindow, lengthMin: shiftWindowMinutes(rules.shiftWindow) }
}

export async function setShiftWindow(scope: HrScope, input: { startsAt: string; endsAt: string }) {
  if (!isValidClock(input.startsAt) || !isValidClock(input.endsAt)) {
    throw ApiError.badRequest('Give the times as 24-hour clock, like 15:00.')
  }
  if (input.startsAt === input.endsAt) throw ApiError.badRequest('A shift that starts and ends at the same minute is not a shift.')

  const tenant = await Tenant.findById(scope.tenantId)
  if (!tenant) throw ApiError.notFound('Tenant not found.')
  tenant.shiftWindow = { startsAt: input.startsAt, endsAt: input.endsAt }
  await tenant.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'SHIFT_WINDOW_SET',
    entity: 'Tenant',
    entityId: scope.tenantId,
    detail: `${input.startsAt} → ${input.endsAt}`,
  })

  const window = resolveShiftWindow(tenant.shiftWindow)
  return { ...window, lengthMin: shiftWindowMinutes(window) }
}

export async function hoursWorked(scope: HrScope, range: { from?: string; to?: string } = {}) {
  const from = range.from ? new Date(range.from) : new Date(Date.now() - 30 * 24 * 60 * 60_000)
  const to = range.to ? new Date(range.to) : new Date()

  const [shifts, staff, rules] = await Promise.all([
    Shift.find({ tenantId: scope.tenantId, openedAt: { $gte: from, $lte: to } }).sort({ openedAt: -1 }).lean(),
    User.find({ tenantId: scope.tenantId }).lean(),
    tenantRules(scope.tenantId),
  ])

  const person = new Map(staff.map((u) => [u._id, u]))
  const expected = shiftWindowMinutes(rules.shiftWindow)
  const byAgent = new Map<string, { minutes: number; shifts: number; open: number; lastSeen: Date | null }>()

  for (const shift of shifts) {
    const closedAt = shift.closedAt ? new Date(shift.closedAt) : null
    const minutes = closedAt ? Math.max(0, Math.round((closedAt.getTime() - new Date(shift.openedAt).getTime()) / 60_000)) : 0
    const row = byAgent.get(shift.agentId) ?? { minutes: 0, shifts: 0, open: 0, lastSeen: null }
    row.minutes += minutes
    row.shifts += 1
    if (!closedAt) row.open += 1
    const seen = closedAt ?? new Date(shift.openedAt)
    if (!row.lastSeen || seen > row.lastSeen) row.lastSeen = seen
    byAgent.set(shift.agentId, row)
  }

  const rows = [...byAgent.entries()].map(([agentId, row]) => ({
    agentId,
    name: person.get(agentId)?.fullName ?? agentId,
    role: person.get(agentId)?.role ?? null,
    shifts: row.shifts,
    stillOpen: row.open,
    minutes: row.minutes,
    hours: Math.round((row.minutes / 60) * 100) / 100,
    expectedHours: Math.round(((row.shifts * expected) / 60) * 100) / 100,
    lastSeen: row.lastSeen,
  }))

  rows.sort((a, b) => b.minutes - a.minutes)
  return {
    from,
    to,
    window: { ...rules.shiftWindow, lengthMin: expected },
    rows,
    totalHours: Math.round((rows.reduce((sum, r) => sum + r.minutes, 0) / 60) * 100) / 100,
  }
}

const PEOPLE_ACTIONS = [
  'SIGNED_IN',
  'SIGNED_OUT',
  'SHIFT_OPENED',
  'SHIFT_FORCE_CLOSED',
  'SHIFT_VARIANCE_RESOLVED',
  'SHIFT_WINDOW_SET',
  'STAFF_INVITED',
  'STAFF_REINVITED',
  'INVITATION_ACCEPTED',
  'CASH_FLOAT_IN',
  'CASH_PAY_OUT',
  'CASH_DROP',
]

export async function peopleAudit(scope: HrScope, filter: { action?: string; agentId?: string; limit?: number } = {}) {
  const q: Record<string, unknown> = { tenantId: scope.tenantId }
  q.action = filter.action ? filter.action : { $in: PEOPLE_ACTIONS }
  if (filter.agentId) q.actorId = filter.agentId

  const [rows, staff] = await Promise.all([
    Audit.find(q).sort({ at: -1 }).limit(Math.min(filter.limit ?? 300, 1000)).lean(),
    User.find({ tenantId: scope.tenantId }, { fullName: 1, role: 1 }).lean(),
  ])
  const name = new Map(staff.map((u) => [u._id, u.fullName]))

  return {
    actions: PEOPLE_ACTIONS,
    rows: rows.map((r) => ({
      _id: r._id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      detail: r.detail ?? null,
      reason: r.reason ?? null,
      actorId: r.actorId,
      actorName: name.get(r.actorId) ?? r.actorId,
      at: r.at,
    })),
  }
}
