import { Shift } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import type { Scope } from '../interfaces/index.js'

export function getOpenShift(scope: Scope) {
  return Shift.findOne({ tenantId: scope.tenantId, stationId: scope.stationId, agentId: scope.agentId, status: { $ne: 'CLOSED' } })
}

export async function openShift(scope: Scope) {
  const existing = await getOpenShift(scope)
  if (existing) return existing
  return Shift.create({ tenantId: scope.tenantId, stationId: scope.stationId, agentId: scope.agentId, status: 'OPEN', openedAt: new Date(), expectedCash: 0 })
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
  return shift
}

export async function resolveVariance(scope: Scope, shiftId: string, note: string) {
  const shift = await Shift.findOne({ _id: shiftId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!shift) throw ApiError.notFound('Shift not found.')
  if (shift.status !== 'RECONCILING') throw ApiError.badRequest('Shift is not awaiting reconciliation.')
  shift.resolutionNote = note
  shift.status = 'CLOSED'
  shift.closedAt = new Date()
  await shift.save()
  return shift
}
