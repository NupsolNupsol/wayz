import { z } from 'zod'
import type { Request } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { BILLING_MODELS, ENGINE_KINDS, SALE_TYPES, SALE_UNITS } from '../domain/types.js'
import {
  addUnits,
  ASSET_KINDS,
  assetTypeDetail,
  assetUnitDetail,
  createAssetKind,
  listAssetTypes,
  removeAssetKind,
  removeUnit,
  SETTABLE_STATUSES,
  updateAssetKind,
  updateTypePrice,
  unitReturnPosition,
  updateUnit,
} from '../services/asset.service.js'
import type { AssetScope } from '../services/asset.service.js'

function assetScope(req: Request): AssetScope {
  if (!req.auth) throw ApiError.unauthorized()
  return {
    tenantId: req.auth.tenantId,
    userId: req.auth.sub,
    role: req.auth.role,
    engineKinds: req.auth.engineKinds ?? [],
  }
}

const capacitySchema = z.object({
  internalDimensions: z.object({ w: z.number().min(1), h: z.number().min(1), d: z.number().min(1) }).optional(),
  maxWeight: z.number().min(0).optional(),
  maxRecommendedBagCount: z.number().int().min(1).optional(),
  compatibleBagCategories: z.array(z.enum(['SOFT', 'HARD', 'OVERSIZE', 'FRAGILE'])).optional(),
  capacityScore: z.number().min(0).optional(),
  seats: z.number().int().min(1).optional(),
})

const kindSchema = z.object({
  name: z.string().min(2).max(60),
  engineKind: z.enum(ENGINE_KINDS),
  kind: z.enum(ASSET_KINDS),
  basePrice: z.number().min(0),
  saleUnit: z.enum(SALE_UNITS).optional(),
  saleType: z.enum(SALE_TYPES).optional(),
  depositRequired: z.number().min(0).optional(),
  penaltyPrice: z.number().min(0).optional(),
  overtimeHourlyRate: z.number().min(0).nullable().optional(),
  billingModel: z.enum(BILLING_MODELS).optional(),
  capacity: capacitySchema.optional(),
  initialCount: z.number().int().min(0).max(200).optional(),
  stationId: z.string().min(1).optional(),
  kioskId: z.string().min(1).nullish(),
})

const kindPatchSchema = z
  .object({ name: z.string().min(2).max(60).optional(), capacity: capacitySchema.optional() })
  .refine((v) => v.name !== undefined || v.capacity !== undefined, { message: 'Nothing to change.' })

const addSchema = z.object({
  stationId: z.string().min(1),
  kioskId: z.string().min(1).nullish(),
  count: z.number().int().min(1).max(200),
  identifierPrefix: z.string().max(8).optional(),
})

const unitSchema = z
  .object({
    status: z.enum(SETTABLE_STATUSES as [string, ...string[]]).optional(),
    note: z.string().max(400).optional(),
    identifier: z.string().min(1).max(40).optional(),
    priceOverride: z.number().min(0).nullable().optional(),
    penaltyPrice: z.number().min(0).nullable().optional(),
    stationId: z.string().min(1).optional(),
    kioskId: z.string().min(1).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' })

const PRICE_FIELDS = ['basePrice', 'depositRequired', 'penaltyPrice', 'saleUnit', 'saleType', 'overtimeHourlyRate'] as const

const priceSchema = z
  .object({
    basePrice: z.number().min(0).optional(),
    depositRequired: z.number().min(0).optional(),
    penaltyPrice: z.number().min(0).optional(),
    saleUnit: z.enum(SALE_UNITS).optional(),
    saleType: z.enum(SALE_TYPES).optional(),
    overtimeHourlyRate: z.number().min(0).nullable().optional(),
    clearOverrides: z.boolean().optional(),
  })
  .refine((v) => PRICE_FIELDS.some((field) => v[field] !== undefined), {
    message: 'Give a price to change.',
  })

export const assetController = {
  types: asyncHandler(async (req, res) => {
    const engineKind = req.query.engineKind ? z.enum(ENGINE_KINDS).parse(req.query.engineKind) : undefined
    res.json({ success: true, data: await listAssetTypes(assetScope(req), engineKind) })
  }),

  createType: asyncHandler(async (req, res) => {
    const body = kindSchema.parse(req.body)
    const data = await createAssetKind(assetScope(req), { ...body, kioskId: body.kioskId ?? null })
    res.status(201).json({ success: true, data })
  }),

  updateType: asyncHandler(async (req, res) => {
    const body = kindPatchSchema.parse(req.body)
    res.json({ success: true, data: await updateAssetKind(assetScope(req), req.params.id, body) })
  }),

  removeType: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await removeAssetKind(assetScope(req), req.params.id) })
  }),

  typeDetail: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await assetTypeDetail(assetScope(req), req.params.id) })
  }),

  addUnits: asyncHandler(async (req, res) => {
    const body = addSchema.parse(req.body)
    const data = await addUnits(assetScope(req), req.params.id, { ...body, kioskId: body.kioskId ?? null })
    res.status(201).json({ success: true, data })
  }),

  price: asyncHandler(async (req, res) => {
    const body = priceSchema.parse(req.body)
    res.json({ success: true, data: await updateTypePrice(assetScope(req), req.params.id, body) })
  }),

  returnPosition: asyncHandler(async (req, res) => {
    if (!req.auth) throw ApiError.unauthorized()
    res.json({
      success: true,
      data: await unitReturnPosition(
        {
          tenantId: req.auth.tenantId,
          stationId: req.auth.stationId,
          agentId: req.auth.sub,
          role: req.auth.role,
          kioskId: req.auth.kioskId ?? null,
          engineKinds: req.auth.engineKinds ?? [],
        },
        req.params.id,
      ),
    })
  }),

  unit: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await assetUnitDetail(assetScope(req), req.params.id) })
  }),

  updateUnit: asyncHandler(async (req, res) => {
    const body = unitSchema.parse(req.body)
    const data = await updateUnit(assetScope(req), req.params.id, body as Parameters<typeof updateUnit>[2])
    res.json({ success: true, data })
  }),

  removeUnit: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await removeUnit(assetScope(req), req.params.id) })
  }),
}
