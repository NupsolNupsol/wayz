import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { createIncident, listIncidents, updateIncidentStatus } from '../services/incident.service.js'
import { INCIDENT_TYPES } from '../domain/incidents.js'
import { ENGINE_KINDS } from '../domain/types.js'

export const incidentController = {
  list: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listIncidents(scopeFromReq(req)) })
  }),

  create: asyncHandler(async (req, res) => {
    const body = z
      .object({
        type: z.enum(INCIDENT_TYPES),
        description: z.string().min(1),
        bookingId: z.string().optional(),
        engineKind: z.enum(ENGINE_KINDS).optional(),
      })
      .parse(req.body)
    res.status(201).json({ success: true, data: await createIncident(scopeFromReq(req), body) })
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const body = z.object({ status: z.enum(['REPORTED', 'INVESTIGATING', 'AWAITING_APPROVAL', 'RESOLVED', 'REJECTED']) }).parse(req.body)
    res.json({ success: true, data: await updateIncidentStatus(scopeFromReq(req), req.params.id, body.status) })
  }),
}
