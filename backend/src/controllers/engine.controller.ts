import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { getWorkflowByKind, listIncidentCatalogue, listWorkflows } from '../services/engine.service.js'

export const engineController = {
  workflows: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: listWorkflows() })
  }),

  incidentTypes: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: listIncidentCatalogue() })
  }),

  workflow: asyncHandler(async (req, res) => {
    const wf = getWorkflowByKind(req.params.kind)
    if (!wf) throw ApiError.notFound('Unknown engine.')
    res.json({ success: true, data: wf })
  }),
}
