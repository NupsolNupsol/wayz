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
  readRules,
  updateCompany,
  updateRules,
} from '../services/tenantAdmin.service.js'
import { saveStationMap, stationMap } from '../services/org.service.js'
import type { ManagerScope } from '../interfaces/index.js'

function adminScope(req: Request): ManagerScope {
  if (!req.auth) throw ApiError.unauthorized()
  return {
    tenantId: req.auth.tenantId,
    userId: req.auth.sub,
    role: req.auth.role,
    engineKinds: req.auth.engineKinds ?? [],
  }
}

const timerSchema = z.object({
  startsOn: z.enum(['FULFILMENT', 'PAYMENT']),
  startDelayMin: z.number().min(0).max(240),
})

const rulesSchema = z.object({
  rental: z
    .object({
      graceMin: z.number().min(0).max(240).optional(),
      statedGraceMin: z.number().min(0).max(240).optional(),
      overtimeBlockMin: z.number().min(1).max(1440).optional(),
      replacementBonusMin: z.number().min(0).max(240).optional(),
      wrongStationPenalty: z.number().min(0).optional(),
      timers: z.record(z.enum(ENGINE_KINDS), timerSchema).optional(),
    })
    .optional(),
  penalties: z
    .array(
      z.object({
        code: z.string().min(2).max(60),
        label: z.string().min(2).max(160),
        amount: z.number().min(0).nullable(),
        engineKind: z.enum(ENGINE_KINDS).nullable().default(null),
      }),
    )
    .max(100)
    .optional(),
})

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

const mapSchema = z.object({
  placements: z
    .array(
      z.object({
        id: z.string().min(1),
        x: z.number().min(0).max(1).nullable(),
        y: z.number().min(0).max(1).nullable(),
      }),
    )
    .min(1, 'Nothing to place.'),
})

export const tenantAdminController = {
  stationMap: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await stationMap(adminScope(req).tenantId) })
  }),

  saveStationMap: asyncHandler(async (req, res) => {
    const body = mapSchema.parse(req.body)
    res.json({ success: true, data: await saveStationMap(adminScope(req).tenantId, body.placements) })
  }),

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

  rules: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await readRules(adminScope(req)) })
  }),

  updateRules: asyncHandler(async (req, res) => {
    const body = rulesSchema.parse(req.body)
    res.json({ success: true, data: await updateRules(adminScope(req), body) })
  }),
}
