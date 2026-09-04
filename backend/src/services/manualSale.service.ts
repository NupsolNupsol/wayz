import { ManualSale, Station, Tenant, type ManualSaleStatus } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { raise } from './notification.service.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { formatId, nextSequence, pad } from './counter.service.js'
import { DEFAULT_VAT_RATE, splitInclusive } from '../domain/tax.js'
import { ENGINE_KINDS, PAYMENT_METHODS, type EngineKind, type PaymentMethod } from '../domain/types.js'
import type { ManagerScope } from '../interfaces/index.js'

export interface ManualSaleInput {
  stationId: string
  engineKind: EngineKind
  description: string
  amount: number
  method: PaymentMethod
  occurredAt: string
}

export interface ManualSaleFilter {
  status?: ManualSaleStatus
  from?: string
  to?: string
}

const APPROVERS = ['TENANT_ADMIN'] as const

export async function listManualSales(scope: ManagerScope, filter: ManualSaleFilter = {}) {
  const q: Record<string, unknown> = { tenantId: scope.tenantId }
  if (filter.status) q.status = filter.status
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {}
    if (filter.from) range.$gte = new Date(`${filter.from}T00:00:00.000Z`)
    if (filter.to) {
      const to = new Date(`${filter.to}T00:00:00.000Z`)
      to.setUTCHours(23, 59, 59, 999)
      range.$lte = to
    }
    q.occurredAt = range
  }

  const [rows, stations] = await Promise.all([
    ManualSale.find(q).sort({ occurredAt: -1, createdAt: -1 }).limit(500).lean(),
    Station.find({ tenantId: scope.tenantId }, { name: 1 }).lean(),
  ])
  const stationName = new Map(stations.map((s) => [s._id, s.name]))

  return {
    canApprove: (APPROVERS as readonly string[]).includes(scope.role),
    stations: stations.map((st) => ({ _id: st._id, name: st.name })),
    rows: rows.map((row) => ({ ...row, stationName: stationName.get(row.stationId) ?? row.stationId })),
    pendingTotal: round2(
      rows.filter((r) => r.status === 'PENDING').reduce((sum, r) => sum + r.amount, 0),
    ),
  }
}

export async function recordManualSale(scope: ManagerScope, input: ManualSaleInput) {
  if (!ENGINE_KINDS.includes(input.engineKind)) throw ApiError.badRequest(`Unknown activity "${input.engineKind}".`)
  if (!PAYMENT_METHODS.includes(input.method)) throw ApiError.badRequest(`Unknown payment method "${input.method}".`)
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw ApiError.badRequest('Enter an amount greater than zero.')

  const occurredAt = new Date(input.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) throw ApiError.badRequest('Give the date the money was actually taken.')
  if (occurredAt.getTime() > Date.now()) throw ApiError.badRequest('A manual entry records revenue already taken, not future revenue.')

  const station = await Station.findOne({ _id: input.stationId, tenantId: scope.tenantId }).lean()
  if (!station) throw ApiError.badRequest('That station does not exist in this tenant.')

  const tenant = await Tenant.findById(scope.tenantId, { vatRate: 1 }).lean()
  const tax = splitInclusive(round2(input.amount), tenant?.vatRate ?? DEFAULT_VAT_RATE)

  const seq = await nextSequence('manualSale')
  const sale = await ManualSale.create({
    _id: formatId('manualSale', seq),
    ref: `MAN-${pad(seq)}`,
    tenantId: scope.tenantId,
    stationId: input.stationId,
    engineKind: input.engineKind,
    description: input.description.trim(),
    amount: tax.totalAmount,
    baseAmount: tax.baseAmount,
    vatAmount: tax.vatAmount,
    vatRate: tax.vatRate,
    method: input.method,
    occurredAt,
    status: 'PENDING',
    enteredBy: scope.userId,
  })

  await raise({
    tenantId: scope.tenantId,
    stationId: input.stationId,
    engineKind: input.engineKind,
    title: 'Manual sale awaiting approval',
    body: `${sale.ref}: ${tax.totalAmount} entered by hand. It counts for nothing until it is bank-matched and approved.`,
    level: 'warning',
    audience: [...APPROVERS],
    link: '/manual-sales',
  })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'MANUAL_SALE_ENTERED',
    entity: 'ManualSale',
    entityId: sale._id,
    detail: `${sale.ref} · ${tax.totalAmount} · ${input.engineKind}`,
    reason: input.description,
  })

  return sale.toObject()
}

export async function reviewManualSale(
  scope: ManagerScope,
  id: string,
  decision: { approve: boolean; note?: string },
) {
  if (!(APPROVERS as readonly string[]).includes(scope.role)) {
    throw ApiError.forbidden('Only the tenant admin approves a manual sale.')
  }

  const sale = await ManualSale.findOne({ _id: id, tenantId: scope.tenantId })
  if (!sale) throw ApiError.notFound('Manual sale not found.')
  if (sale.status !== 'PENDING') throw ApiError.badRequest(`${sale.ref} has already been ${sale.status.toLowerCase()}.`)
  if (sale.enteredBy === scope.userId) {
    throw ApiError.forbidden('Someone else has to approve an entry you made yourself.')
  }
  if (!decision.approve && !decision.note?.trim()) {
    throw ApiError.badRequest('Say why it is being rejected.')
  }

  sale.status = decision.approve ? 'APPROVED' : 'REJECTED'
  sale.reviewedBy = scope.userId
  sale.reviewedAt = new Date()
  sale.reviewNote = decision.note?.trim() ?? ''
  await sale.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: decision.approve ? 'MANUAL_SALE_APPROVED' : 'MANUAL_SALE_REJECTED',
    entity: 'ManualSale',
    entityId: sale._id,
    detail: `${sale.ref} · ${sale.amount}`,
    reason: sale.reviewNote || undefined,
  })

  return sale.toObject()
}

export async function approvedManualRevenue(tenantId: string, from: Date, to: Date) {
  return ManualSale.find({ tenantId, status: 'APPROVED', occurredAt: { $gte: from, $lte: to } }).lean()
}
