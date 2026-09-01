import { Booking, Incident } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { recordAudit } from './audit.service.js'
import { allowedEngines, canWorkEngine } from '../domain/access.js'
import { formatId, nextSequence, pad } from './counter.service.js'
import type { EngineKind } from '../domain/types.js'
import { isIncidentTypeValidFor } from '../domain/incidents.js'
import { INCIDENT_LABELS } from '../constants/labels.constants.js'

import type { CreateIncidentInput } from '../interfaces/index.js'
import type { Scope } from '../interfaces/index.js'

export function listIncidents(scope: Scope) {
  const q: Record<string, unknown> = { tenantId: scope.tenantId, stationId: scope.stationId }
  const allowed = allowedEngines(scope)
  // A station-wide incident carries no activity, so it stays visible to whoever is on the floor.
  if (allowed) q.engineKind = { $in: [...allowed, null] }
  return Incident.find(q).sort({ createdAt: -1 }).limit(200).lean()
}

export async function createIncident(scope: Scope, data: CreateIncidentInput) {
  let engineKind: EngineKind | null = data.engineKind ?? null

  if (data.bookingId) {
    const booking = await Booking.findOne({ _id: data.bookingId, tenantId: scope.tenantId, stationId: scope.stationId }).lean()
    if (!booking) throw ApiError.notFound('Booking not found.')
    engineKind = booking.engineKind
  }

  if (engineKind && !canWorkEngine(scope, engineKind)) {
    throw ApiError.forbidden('You are not assigned to that activity.')
  }

  if (!isIncidentTypeValidFor(engineKind, data.type)) {
    throw ApiError.unprocessable(
      `"${INCIDENT_LABELS[data.type] ?? data.type}" is not a valid incident for ${engineKind ?? 'this station'}.`,
    )
  }

  const seq = await nextSequence('incident')
  const incident = await Incident.create({
    _id: formatId('incident', seq),
    ref: `INC-${pad(seq)}`,
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    reportedBy: scope.agentId,
    type: data.type,
    description: data.description,
    bookingId: data.bookingId ?? null,
    engineKind,
    status: 'REPORTED',
  })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'INCIDENT_REPORTED',
    entity: 'Incident',
    entityId: incident._id,
    detail: `${incident.ref} · ${INCIDENT_LABELS[data.type] ?? data.type}`,
    reason: data.description,
  })

  return incident
}

export async function updateIncidentStatus(scope: Scope, id: string, status: string) {
  const inc = await Incident.findOne({ _id: id, tenantId: scope.tenantId })
  if (!inc) throw ApiError.notFound('Incident not found.')
  if (inc.engineKind && !canWorkEngine(scope, inc.engineKind)) throw ApiError.notFound('Incident not found.')
  const from = inc.status
  inc.status = status as typeof inc.status
  await inc.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'INCIDENT_STATUS_CHANGED',
    entity: 'Incident',
    entityId: inc._id,
    detail: `${inc.ref} · ${from} → ${status}`,
  })

  return inc
}
