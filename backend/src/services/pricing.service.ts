import { AssetType, Booking, CatalogueProduct, Tenant } from '../models/index.js'
import { BILLING_MODELS, DURATION_UNITS } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { DEFAULT_VAT_RATE } from '../domain/tax.js'
import { nextId } from './counter.service.js'

import type { ProductInput, SettingsPatch } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

export async function listPricing(scope: ManagerScope) {
  const [products, assetTypes, tenant, revenueAgg] = await Promise.all([
    CatalogueProduct.find({ tenantId: scope.tenantId }).sort({ engineKind: 1, name: 1 }).lean(),
    AssetType.find({ tenantId: scope.tenantId }).lean(),
    Tenant.findById(scope.tenantId).lean(),
    Booking.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $group: { _id: '$productName', bookings: { $sum: 1 } } },
    ]),
  ])

  const typeName = new Map(assetTypes.map((t) => [t._id, t.name]))
  const usage = new Map(revenueAgg.map((r: { _id: string; bookings: number }) => [r._id, r.bookings]))

  return {
    currency: tenant?.currency ?? 'SAR',
    vatRate: tenant?.vatRate ?? DEFAULT_VAT_RATE,
    billingModels: [...BILLING_MODELS],
    durationUnits: [...DURATION_UNITS],
    assetTypes: assetTypes.map((t) => ({ _id: t._id, name: t.name, kind: t.kind, engineKind: t.engineKind })),
    products: products.map((p) => ({
      _id: p._id,
      name: p.name,
      engineKind: p.engineKind,
      category: p.category,
      basePrice: p.basePrice,
      overtimeHourlyRate: p.overtimeHourlyRate ?? null,
      effectiveOvertimeRate: p.overtimeHourlyRate ?? p.basePrice,
      depositRequired: p.depositRequired,
      assetTypeId: p.assetTypeId,
      assetTypeName: p.assetTypeId ? (typeName.get(p.assetTypeId) ?? null) : null,
      billingModel: p.billingModel,
      durationUnit: p.durationUnit ?? null,
      emoji: p.emoji,
      active: p.active !== false,
      bookingsAllTime: [...usage.entries()]
        .filter(([name]) => String(name).startsWith(p.name))
        .reduce((sum, [, n]) => sum + n, 0),
    })),
  }
}

function validate(input: Partial<ProductInput>) {
  if (input.basePrice !== undefined && (!Number.isFinite(input.basePrice) || input.basePrice < 0)) {
    throw ApiError.badRequest('Base price must be zero or more.')
  }
  if (input.overtimeHourlyRate != null && (!Number.isFinite(input.overtimeHourlyRate) || input.overtimeHourlyRate < 0)) {
    throw ApiError.badRequest('Overtime rate must be zero or more.')
  }
  if (input.depositRequired !== undefined && (!Number.isFinite(input.depositRequired) || input.depositRequired < 0)) {
    throw ApiError.badRequest('Deposit must be zero or more.')
  }
  if (input.billingModel && !BILLING_MODELS.includes(input.billingModel)) {
    throw ApiError.badRequest(`Unknown billing model "${input.billingModel}".`)
  }
}

export async function createProduct(scope: ManagerScope, input: ProductInput) {
  validate(input)
  if (input.assetTypeId) {
    const type = await AssetType.findOne({ _id: input.assetTypeId, tenantId: scope.tenantId }).lean()
    if (!type) throw ApiError.badRequest('That asset type does not exist in this tenant.')
    if (type.engineKind !== input.engineKind) {
      throw ApiError.badRequest(`${type.name} belongs to ${type.engineKind}, not ${input.engineKind}.`)
    }
  }

  return CatalogueProduct.create({
    _id: await nextId('product'),
    tenantId: scope.tenantId,
    engineKind: input.engineKind,
    name: input.name.trim(),
    category: input.category ?? 'General',
    basePrice: round2(input.basePrice),
    overtimeHourlyRate: input.overtimeHourlyRate == null ? null : round2(input.overtimeHourlyRate),
    depositRequired: round2(input.depositRequired ?? 0),
    assetTypeId: input.assetTypeId ?? null,
    billingModel: input.billingModel,
    durationUnit: input.durationUnit,
    emoji: input.emoji ?? '📦',
    active: true,
  })
}

export async function updateProduct(scope: ManagerScope, id: string, patch: Partial<ProductInput>) {
  validate(patch)
  const product = await CatalogueProduct.findOne({ _id: id, tenantId: scope.tenantId })
  if (!product) throw ApiError.notFound('Product not found.')

  if (patch.name !== undefined) product.name = patch.name.trim()
  if (patch.category !== undefined) product.category = patch.category
  if (patch.basePrice !== undefined) product.basePrice = round2(patch.basePrice)
  if (patch.overtimeHourlyRate !== undefined) {
    product.overtimeHourlyRate = patch.overtimeHourlyRate == null ? null : round2(patch.overtimeHourlyRate)
  }
  if (patch.depositRequired !== undefined) product.depositRequired = round2(patch.depositRequired)
  if (patch.billingModel !== undefined) product.billingModel = patch.billingModel
  if (patch.durationUnit !== undefined) product.durationUnit = patch.durationUnit
  if (patch.emoji !== undefined) product.emoji = patch.emoji
  if (patch.active !== undefined) product.active = patch.active

  await product.save()
  return product
}

export async function getSettings(scope: ManagerScope) {
  const tenant = await Tenant.findById(scope.tenantId).lean()
  if (!tenant) throw ApiError.notFound('Tenant not found.')
  return {
    _id: tenant._id,
    name: tenant.name,
    legalName: tenant.legalName,
    crNumber: tenant.crNumber,
    vatNumber: tenant.vatNumber,
    vatRate: tenant.vatRate,
    currency: tenant.currency,
    enabledEngines: tenant.enabledEngines,
    branding: tenant.branding,
    company: tenant.company ?? {},
    settings: tenant.settings ?? {},
  }
}

export async function updateSettings(scope: ManagerScope, patch: SettingsPatch) {
  const tenant = await Tenant.findById(scope.tenantId)
  if (!tenant) throw ApiError.notFound('Tenant not found.')

  if (patch.vatRate !== undefined) {
    if (!Number.isFinite(patch.vatRate) || patch.vatRate < 0 || patch.vatRate > 1) {
      throw ApiError.badRequest('VAT rate is a fraction between 0 and 1 (0.15 = 15%).')
    }
    tenant.vatRate = patch.vatRate
  }
  if (patch.name) tenant.name = patch.name.trim()
  if (patch.legalName) tenant.legalName = patch.legalName.trim()
  if (patch.crNumber !== undefined) tenant.crNumber = patch.crNumber
  if (patch.vatNumber !== undefined) tenant.vatNumber = patch.vatNumber
  if (patch.currency) tenant.currency = patch.currency.trim().toUpperCase()
  if (patch.company) tenant.company = { ...tenant.company, ...patch.company } as typeof tenant.company

  if (patch.settings) {
    const s = patch.settings as Record<string, number | string | string[]>
    const grace = Number(s.gracePeriodMin ?? tenant.settings.gracePeriodMin)
    if (!Number.isFinite(grace) || grace < 0 || grace > 120) {
      throw ApiError.badRequest('Grace period must be between 0 and 120 minutes.')
    }
    tenant.settings = { ...tenant.settings, ...patch.settings } as typeof tenant.settings
  }

  await tenant.save()
  return getSettings(scope)
}
