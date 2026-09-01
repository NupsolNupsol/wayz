import { z } from 'zod'
import type { Request } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ENGINE_KINDS } from '../domain/types.js'

import {
  tenantAudit,
  tenantIsolationReport,
  tenantOverview,
  tenantPeople,
  updateCompany,
} from '../services/tenantAdmin.service.js'
import type { ManagerScope } from '../interfaces/index.js'

function adminScope(req: Request): ManagerScope {
  if (!req.auth) throw ApiError.unauthorized()
  return { tenantId: req.auth.tenantId, userId: req.auth.sub, role: req.auth.role }
}

const companySchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().min(2).optional(),
  crNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  currency: z.string().min(3).max(3).optional(),
  vatRate: z.coerce.number().min(0).max(1).optional(),
  enabledEngines: z.array(z.enum(ENGINE_KINDS)).optional(),
  company: z.record(z.string()).optional(),
  branding: z.record(z.string()).optional(),
})

export const tenantAdminController = {
  overview: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await tenantOverview(adminScope(req)) })
  }),

  people: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await tenantPeople(adminScope(req)) })
  }),

  audit: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await tenantAudit(adminScope(req)) })
  }),

  isolation: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await tenantIsolationReport(adminScope(req)) })
  }),

  updateCompany: asyncHandler(async (req, res) => {
    const body = companySchema.parse(req.body)
    res.json({ success: true, data: await updateCompany(adminScope(req), body) })
  }),
}
