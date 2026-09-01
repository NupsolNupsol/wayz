import { z } from 'zod'
import type { Request } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { EXPENSE_CATEGORIES } from '../models/index.js'
import { ENGINE_KINDS, ROLES } from '../domain/types.js'
import { chargeSeasonPayroll, createSeason, hrOverview, listExpenses, listSeasons, recordExpense, seasonDetail, voidExpense } from '../services/hr.service.js'
import type { HrScope } from '../interfaces/index.js'

function hrScope(req: Request): HrScope {
  if (!req.auth) throw ApiError.unauthorized()
  return { tenantId: req.auth.tenantId, userId: req.auth.sub }
}

const filterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  engineKind: z.enum(ENGINE_KINDS).optional(),
  seasonId: z.string().optional(),
})

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(3),
  supplier: z.string().max(120).optional(),
  reference: z.string().max(120).optional(),
  engineKind: z.enum(ENGINE_KINDS).nullable().optional(),
  seasonId: z.string().nullable().optional(),
  amount: z.number().positive(),
  incurredAt: z.string().optional(),
  vatInclusive: z.boolean().optional(),
})

const seasonSchema = z.object({
  name: z.string().min(2),
  startsAt: z.string(),
  endsAt: z.string(),
})

const payrollSchema = z.object({
  seasonId: z.string().min(1),
  months: z.number().int().min(1).max(24).optional(),
  monthlyCostByRole: z.record(z.enum(ROLES), z.number().min(0)),
})

export const hrController = {
  overview: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await hrOverview(hrScope(req), filterSchema.parse(req.query)) })
  }),

  expenses: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listExpenses(hrScope(req), filterSchema.parse(req.query)) })
  }),

  createExpense: asyncHandler(async (req, res) => {
    const body = expenseSchema.parse(req.body)
    res.status(201).json({ success: true, data: await recordExpense(hrScope(req), body) })
  }),

  voidExpense: asyncHandler(async (req, res) => {
    const body = z.object({ reason: z.string().min(3) }).parse(req.body)
    res.json({ success: true, data: await voidExpense(hrScope(req), req.params.id, body.reason) })
  }),

  seasons: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listSeasons(hrScope(req)) })
  }),

  season: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await seasonDetail(hrScope(req), req.params.id) })
  }),

  createSeason: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await createSeason(hrScope(req), seasonSchema.parse(req.body)) })
  }),

  chargePayroll: asyncHandler(async (req, res) => {
    const body = payrollSchema.parse(req.body)
    res.json({ success: true, data: await chargeSeasonPayroll(hrScope(req), body) })
  }),
}
