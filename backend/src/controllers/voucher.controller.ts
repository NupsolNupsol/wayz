import { z } from 'zod'
import type { Request } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ENGINE_KINDS } from '../domain/types.js'
import { campaignCodes, checkVoucher, createCampaign, listCampaigns, redeemVoucher, voidCampaign } from '../services/voucher.service.js'
import { scopeFromReq } from '../utils/scope.js'
import type { ManagerScope } from '../interfaces/index.js'

function managerScope(req: Request): ManagerScope {
  if (!req.auth) throw ApiError.unauthorized()
  return { tenantId: req.auth.tenantId, userId: req.auth.sub, role: req.auth.role, engineKinds: req.auth.engineKinds ?? [] }
}

const campaignSchema = z.object({
  name: z.string().min(2).max(80),
  percent: z.coerce.number().min(1).max(100),
  quantity: z.coerce.number().int().min(1),
  engineKinds: z.array(z.enum(ENGINE_KINDS)).optional(),
  expiresAt: z.string().nullable().optional(),
  prefix: z.string().max(6).optional(),
  note: z.string().max(240).optional(),
})

const codeSchema = z.object({ code: z.string().min(3).max(40) })

export const voucherController = {
  list: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listCampaigns(managerScope(req)) })
  }),
  create: asyncHandler(async (req, res) => {
    const body = campaignSchema.parse(req.body)
    res.status(201).json({ success: true, data: await createCampaign(managerScope(req), body) })
  }),
  codes: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await campaignCodes(managerScope(req), req.params.id) })
  }),
  stop: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await voidCampaign(managerScope(req), req.params.id) })
  }),

  check: asyncHandler(async (req, res) => {
    const body = codeSchema.parse(req.body)
    res.json({ success: true, data: await checkVoucher(scopeFromReq(req), body.code) })
  }),
  redeem: asyncHandler(async (req, res) => {
    const body = codeSchema.parse(req.body)
    res.json({ success: true, data: await redeemVoucher(scopeFromReq(req), req.params.id, body.code) })
  }),
}
