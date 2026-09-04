import { z } from 'zod'
import type { Request } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ENGINE_KINDS, PAYMENT_METHODS } from '../domain/types.js'
import { MANUAL_SALE_STATUSES } from '../models/index.js'
import { listManualSales, recordManualSale, reviewManualSale } from '../services/manualSale.service.js'
import type { ManagerScope } from '../interfaces/index.js'

function scope(req: Request): ManagerScope {
  if (!req.auth) throw ApiError.unauthorized()
  return {
    tenantId: req.auth.tenantId,
    userId: req.auth.sub,
    role: req.auth.role,
    engineKinds: req.auth.engineKinds ?? [],
  }
}

const createSchema = z.object({
  stationId: z.string().min(1),
  engineKind: z.enum(ENGINE_KINDS),
  description: z.string().min(3).max(300),
  amount: z.coerce.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  occurredAt: z.string().min(4),
})

const listQuery = z.object({
  status: z.enum(MANUAL_SALE_STATUSES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

const reviewSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(300).optional(),
})

export const manualSaleController = {
  list: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listManualSales(scope(req), listQuery.parse(req.query)) })
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await recordManualSale(scope(req), createSchema.parse(req.body)) })
  }),

  review: asyncHandler(async (req, res) => {
    const body = reviewSchema.parse(req.body)
    res.json({ success: true, data: await reviewManualSale(scope(req), req.params.id, body) })
  }),
}
