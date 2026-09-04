import { CashMovement, Shift, User } from '../models/index.js'
import type { ShiftDoc } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { FLOOR_LEADS, SELLING_STAFF } from '../domain/roles.js'
import { raise } from './notification.service.js'
import { recordAudit } from './audit.service.js'
import { nextId } from './counter.service.js'
import type { Scope } from '../interfaces/index.js'

type ShiftHydrated = ShiftDoc

export function getOpenShift(scope: Scope) {
  return Shift.findOne({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    agentId: scope.agentId,
    status: { $ne: 'CLOSED' },
  })
}

export async function openShift(scope: Scope, openingFloat = 0) {
  const existing = await getOpenShift(scope)
  if (existing) return existing

  const float = round2(Math.max(0, openingFloat))
  const shift = await Shift.create({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: scope.kioskId ?? null,
    agentId: scope.agentId,
    status: 'OPEN',
    openedAt: new Date(),
    openingFloat: float,
    expectedCash: float,
  })

  if (float > 0) {
    await CashMovement.create({
      _id: await nextId('cashMovement'),
      tenantId: scope.tenantId,
      stationId: scope.stationId,
      shiftId: shift._id,
      actorId: scope.agentId,
      kind: 'FLOAT_IN',
      amount: float,
      baseAmount: float,
      vatAmount: 0,
      vatRate: 0,
      reason: 'Opening float',
      reference: '',
    })
  }

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'SHIFT_OPENED',
    entity: 'Shift',
    entityId: shift._id,
    detail: `Opening float ${float.toFixed(2)}`,
  })

  return shift
}

export async function tillForTransaction(scope: Scope, opts: { cash: boolean }) {
  const shift = await Shift.findOne({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    agentId: scope.agentId,
    status: 'OPEN',
  })
  if (shift) return shift

  if (SELLING_STAFF.includes(scope.role)) {
    throw ApiError.unprocessable('Open your till before taking any money.', [
      'Nothing is sold, extended or settled at a counter whose drawer is shut — open one from the header and it will be here.',
    ])
  }
  if (opts.cash) {
    throw ApiError.unprocessable('Open your till before taking cash.', [
      'Cash taken without an open till cannot be reconciled at the end of the day.',
    ])
  }
  return null
}

export async function submitBlindCount(scope: Scope, shiftId: string, countedCash: number) {
  const shift = await Shift.findOne({ _id: shiftId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!shift) throw ApiError.notFound('Shift not found.')
  if (shift.status === 'CLOSED') throw ApiError.badRequest('Shift already closed.')
  shift.countedCash = round2(countedCash)
  shift.variance = round2(countedCash - shift.expectedCash)
  if (shift.variance === 0) {
    shift.status = 'CLOSED'
    shift.closedAt = new Date()
  } else {
    shift.status = 'RECONCILING'
  }
  await shift.save()

  await announceVariance(scope, shift)
  return shift
}

async function announceVariance(scope: Scope, shift: ShiftHydrated, forcedBy?: string) {
  if (!shift.variance) return
  const agent = await User.findById(shift.agentId, { fullName: 1 }).lean()
  const over = shift.variance > 0 ? 'over' : 'short'
  await raise({
    tenantId: scope.tenantId,
    stationId: shift.stationId,
    kioskId: shift.kioskId,
    title: forcedBy ? 'Forgotten till closed off' : 'Till does not balance',
    body: `${agent?.fullName ?? 'An agent'}'s drawer is ${over} by ${Math.abs(shift.variance)}. Counted ${shift.countedCash} against ${shift.expectedCash} expected${forcedBy ? `, closed by ${forcedBy}` : ''}.`,
    level: shift.variance < 0 ? 'danger' : 'warning',
    audience: FLOOR_LEADS,
    link: '/manager/shifts',
  })
}

export async function resolveVariance(scope: Scope, shiftId: string, note: string) {
  const shift = await Shift.findOne({ _id: shiftId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!shift) throw ApiError.notFound('Shift not found.')
  if (shift.status !== 'RECONCILING') throw ApiError.badRequest('Shift is not awaiting reconciliation.')

  const lead = await User.findById(scope.agentId, { fullName: 1 }).lean()
  shift.resolutionNote = note
  shift.status = 'CLOSED'
  shift.closedAt = new Date()
  shift.closedBy = scope.agentId
  shift.closedByName = lead?.fullName ?? scope.agentId
  await shift.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'SHIFT_VARIANCE_RESOLVED',
    entity: 'Shift',
    entityId: shift._id,
    reason: note,
    detail: `Variance ${round2(shift.variance ?? 0).toFixed(2)}`,
  })

  return shift
}

export async function forceCloseShift(scope: Scope, shiftId: string, input: { countedCash: number; reason: string }) {
  const reason = input.reason?.trim() ?? ''
  if (reason.length < 3) throw ApiError.badRequest('Say why the till is being closed for them.')
  if (!Number.isFinite(input.countedCash) || input.countedCash < 0) {
    throw ApiError.badRequest('Count what is in the drawer before closing it.')
  }

  const shift = await Shift.findOne({ _id: shiftId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!shift) throw ApiError.notFound('Shift not found.')
  if (shift.status === 'CLOSED') throw ApiError.badRequest('That till is already closed.')
  if (shift.agentId === scope.agentId) {
    throw ApiError.badRequest('This is your own till — close it by counting it on the shift page.')
  }

  const lead = await User.findById(scope.agentId, { fullName: 1 }).lean()
  shift.countedCash = round2(input.countedCash)
  shift.variance = round2(shift.countedCash - shift.expectedCash)
  shift.resolutionNote = reason
  shift.status = 'CLOSED'
  shift.closedAt = new Date()
  shift.closedBy = scope.agentId
  shift.closedByName = lead?.fullName ?? scope.agentId
  await shift.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'SHIFT_FORCE_CLOSED',
    entity: 'Shift',
    entityId: shift._id,
    reason,
    detail: `Counted ${shift.countedCash.toFixed(2)} against ${round2(shift.expectedCash).toFixed(2)} expected`,
  })

  await announceVariance(scope, shift, lead?.fullName ?? scope.agentId)
  return shift
}
