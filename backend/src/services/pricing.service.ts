import { AssetType, AssetUnit, Booking, CatalogueProduct, Kiosk, Station, Tenant } from '../models/index.js'
import {
  BILLING_MODELS,
  DURATION_UNITS,
  ENGINE_KINDS,
  SALE_TYPES,
  SALE_UNITS,
  billingAllowedFor,
  chargesForTime,
  saleUnitsFor,
} from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { DEFAULT_VAT_RATE } from '../domain/tax.js'
import { nextId } from './counter.service.js'
import { addUnits } from './asset.service.js'

import type { ProductInput, SettingsPatch } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

export async function listPricing(scope: ManagerScope) {
  const [products, assetTypes, tenant, stations, kiosks, unitPlaces, revenueAgg] = await Promise.all([
    CatalogueProduct.find({ tenantId: scope.tenantId }).sort({ engineKind: 1, name: 1 }).lean(),
    AssetType.find({ tenantId: scope.tenantId }).lean(),
    Tenant.findById(scope.tenantId).lean(),
    Station.find({ tenantId: scope.tenantId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Kiosk.find({ tenantId: scope.tenantId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    // Where the things behind each product actually sit. A product can be stocked at more than
    // one desk, so this is a list rather than a field on the product.
    AssetUnit.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $group: { _id: { assetTypeId: '$assetTypeId', stationId: '$stationId', kioskId: '$kioskId' }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $group: { _id: '$productName', bookings: { $sum: 1 } } },
    ]),
  ])

  const typeName = new Map(assetTypes.map((t) => [t._id, t.name]))
  const stationNameOf = new Map(stations.map((st) => [st._id, st.name]))
  const kioskNameOf = new Map(kiosks.map((k) => [k._id, k.name]))

  type Place = { _id: { assetTypeId: string; stationId: string; kioskId: string | null }; count: number }
  const placesByType = new Map<string, { stationId: string; stationName: string; kioskId: string | null; kioskName: string; count: number }[]>()
  for (const row of unitPlaces as Place[]) {
    const list = placesByType.get(row._id.assetTypeId) ?? []
    list.push({
      stationId: row._id.stationId,
      stationName: stationNameOf.get(row._id.stationId) ?? row._id.stationId,
      kioskId: row._id.kioskId ?? null,
      kioskName: row._id.kioskId ? (kioskNameOf.get(row._id.kioskId) ?? row._id.kioskId) : '',
      count: row.count,
    })
    placesByType.set(row._id.assetTypeId, list)
  }

  const countAtDesk = (assetTypeId: string, stationId: string, kioskId: string | null) =>
    (placesByType.get(assetTypeId) ?? [])
      .filter((place) => place.stationId === stationId && (!kioskId || place.kioskId === kioskId))
      .reduce((sum, place) => sum + place.count, 0)
  const usage = new Map(revenueAgg.map((r: { _id: string; bookings: number }) => [r._id, r.bookings]))

  return {
    currency: tenant?.currency ?? 'SAR',
    vatRate: tenant?.vatRate ?? DEFAULT_VAT_RATE,
    billingModels: [...BILLING_MODELS],
    // What each activity may actually be charged by, so the screen offers only what the API accepts.
    billingByEngine: Object.fromEntries(ENGINE_KINDS.map((k) => [k, billingAllowedFor(k)])),
    saleUnitsByEngine: Object.fromEntries(ENGINE_KINDS.map((k) => [k, saleUnitsFor(k)])),
    timedByEngine: Object.fromEntries(ENGINE_KINDS.map((k) => [k, chargesForTime(k)])),
    durationUnits: [...DURATION_UNITS],
    saleUnits: [...SALE_UNITS],
    saleTypes: [...SALE_TYPES],
    assetTypes: assetTypes.map((t) => ({
      _id: t._id,
      name: t.name,
      kind: t.kind,
      engineKind: t.engineKind,
      // How many people it carries, so a trip or a rental can be sized from the products page.
      seats: t.capacity?.seats ?? null,
    })),
    // Where a new product's first units can be put, so it is sellable at a real counter.
    stations: stations.map((s) => ({ _id: s._id, name: s.name, engineKinds: s.engineKinds })),
    kiosks: kiosks.map((k) => ({ _id: k._id, name: k.name, stationId: k.stationId, engineKind: k.engineKind })),
    products: products.map((p) => ({
      _id: p._id,
      name: p.name,
      nameAr: p.nameAr ?? '',
      engineKind: p.engineKind,
      category: p.category,
      basePrice: p.basePrice,
      hourlyPrice: p.hourlyPrice ?? null,
      tourPrice: p.tourPrice ?? null,
      tourMinutes: p.tourMinutes ?? null,
      saleUnit: p.saleUnit ?? 'ITEM',
      saleType: p.saleType ?? 'RENTAL',
      overtimeHourlyRate: p.overtimeHourlyRate ?? null,
      effectiveOvertimeRate: p.overtimeHourlyRate ?? p.basePrice,
      depositRequired: p.depositRequired,
      penaltyPrice: p.penaltyPrice ?? 0,
      assetTypeId: p.assetTypeId,
      assetTypeName: p.assetTypeId ? (typeName.get(p.assetTypeId) ?? null) : null,
      stationId: p.stationId ?? null,
      stationName: p.stationId ? (stationNameOf.get(p.stationId) ?? p.stationId) : null,
      kioskId: p.kioskId ?? null,
      kioskName: p.kioskId ? (kioskNameOf.get(p.kioskId) ?? p.kioskId) : null,
      stockedAt: p.assetTypeId ? (placesByType.get(p.assetTypeId) ?? []) : [],
      // What the form shows back: how many are standing at this product's own desk.
      unitsHere: p.assetTypeId && p.stationId ? countAtDesk(p.assetTypeId, p.stationId, p.kioskId ?? null) : null,
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
  if (input.penaltyPrice !== undefined && (!Number.isFinite(input.penaltyPrice) || input.penaltyPrice < 0)) {
    throw ApiError.badRequest('Penalty price must be zero or more.')
  }
  if (input.billingModel && !BILLING_MODELS.includes(input.billingModel)) {
    throw ApiError.badRequest(`Unknown billing model "${input.billingModel}".`)
  }
  if (input.billingModel && input.engineKind) {
    const allowed = billingAllowedFor(input.engineKind)
    if (!allowed.includes(input.billingModel)) {
      throw ApiError.unprocessable(
        `${input.engineKind.toLowerCase().replace(/_/g, ' ')} is not charged that way.`,
        [`It can be charged: ${allowed.join(', ')}.`],
      )
    }
  }
  if (input.saleUnit && !SALE_UNITS.includes(input.saleUnit)) {
    throw ApiError.badRequest(`Unknown sale unit "${input.saleUnit}".`)
  }
  if (input.saleUnit && input.engineKind) {
    const units = saleUnitsFor(input.engineKind)
    if (!units.includes(input.saleUnit)) {
      throw ApiError.unprocessable(
        `${input.engineKind.toLowerCase().replace(/_/g, ' ')} is not sold that way.`,
        [`It can be sold: ${units.join(', ')}.`],
      )
    }
  }
  if (input.engineKind && input.overtimeHourlyRate && !chargesForTime(input.engineKind)) {
    throw ApiError.unprocessable(
      `${input.engineKind.toLowerCase().replace(/_/g, ' ')} does not charge for time, so it has no overtime rate.`,
    )
  }
  if (input.saleType && !SALE_TYPES.includes(input.saleType)) {
    throw ApiError.badRequest(`Unknown sale type "${input.saleType}".`)
  }
  if (input.saleType === 'SALE' && input.overtimeHourlyRate) {
    throw ApiError.badRequest('A sale has no overtime — leave the hourly rate empty or make it a rental.')
  }
}

/** How many of a kind are standing at a desk right now. */
export async function unitsAtDesk(tenantId: string, assetTypeId: string, stationId: string, kioskId: string | null) {
  return AssetUnit.countDocuments({
    tenantId,
    assetTypeId,
    stationId,
    ...(kioskId ? { kioskId } : {}),
  })
}

/**
 * The number on the form is how many should be at that desk, not how many to add. Saving 6 when
 * four are there creates two more; saving the same number again changes nothing, which is what
 * makes the field safe to leave filled in when someone reopens the page.
 */
async function stockToMatch(
  scope: ManagerScope,
  input: { assetTypeId: string | null; stationId: string | null; kioskId: string | null; wanted?: number },
) {
  if (!input.assetTypeId || !input.stationId || input.wanted == null) return 0

  const here = await unitsAtDesk(scope.tenantId, input.assetTypeId, input.stationId, input.kioskId ?? null)
  const missing = input.wanted - here
  if (missing === 0) return 0
  if (missing < 0) {
    throw ApiError.unprocessable(`There are already ${here} here.`, [
      'Taking them out of service is done on the estate page, one at a time, so a unit someone is using is never removed by a number in a form.',
    ])
  }

  const added = await addUnits(
    { tenantId: scope.tenantId, userId: scope.userId, role: scope.role, engineKinds: scope.engineKinds },
    input.assetTypeId,
    { stationId: input.stationId, kioskId: input.kioskId ?? null, count: missing },
  )
  return added.created
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

  const product = await CatalogueProduct.create({
    _id: await nextId('product'),
    tenantId: scope.tenantId,
    engineKind: input.engineKind,
    name: input.name.trim(),
    nameAr: input.nameAr?.trim() ?? '',
    category: input.category ?? 'General',
    basePrice: round2(input.basePrice),
    hourlyPrice: input.hourlyPrice == null ? null : round2(input.hourlyPrice),
    tourPrice: input.tourPrice == null ? null : round2(input.tourPrice),
    tourMinutes: input.tourMinutes ?? null,
    saleUnit: input.saleUnit ?? 'ITEM',
    saleType: input.saleType ?? 'RENTAL',
    overtimeHourlyRate: input.overtimeHourlyRate == null ? null : round2(input.overtimeHourlyRate),
    depositRequired: round2(input.depositRequired ?? 0),
    penaltyPrice: round2(input.penaltyPrice ?? 0),
    assetTypeId: input.assetTypeId ?? null,
    stationId: input.stationId ?? null,
    kioskId: input.kioskId ?? null,
    billingModel: input.billingModel,
    durationUnit: input.durationUnit,
    emoji: input.emoji ?? 'Package',
    active: true,
  })

  const provisioned = await stockToMatch(scope, {
    assetTypeId: input.assetTypeId ?? null,
    stationId: input.stationId ?? null,
    kioskId: input.kioskId ?? null,
    wanted: input.initialCount,
  })

  return { ...product.toObject(), provisioned }
}

export async function updateProduct(scope: ManagerScope, id: string, patch: Partial<ProductInput>) {
  validate(patch)
  const product = await CatalogueProduct.findOne({ _id: id, tenantId: scope.tenantId })
  if (!product) throw ApiError.notFound('Product not found.')

  await stockToMatch(scope, {
    assetTypeId: patch.assetTypeId ?? product.assetTypeId,
    stationId: patch.stationId ?? product.stationId,
    kioskId: patch.kioskId ?? product.kioskId,
    wanted: patch.initialCount,
  })

  if (patch.name !== undefined) product.name = patch.name.trim()
  if (patch.nameAr !== undefined) product.nameAr = patch.nameAr.trim()
  if (patch.category !== undefined) product.category = patch.category
  if (patch.basePrice !== undefined) product.basePrice = round2(patch.basePrice)
  if (patch.overtimeHourlyRate !== undefined) {
    product.overtimeHourlyRate = patch.overtimeHourlyRate == null ? null : round2(patch.overtimeHourlyRate)
  }
  if (patch.hourlyPrice !== undefined) product.hourlyPrice = patch.hourlyPrice == null ? null : round2(patch.hourlyPrice)
  if (patch.tourPrice !== undefined) product.tourPrice = patch.tourPrice == null ? null : round2(patch.tourPrice)
  if (patch.tourMinutes !== undefined) product.tourMinutes = patch.tourMinutes ?? null
  if (patch.depositRequired !== undefined) product.depositRequired = round2(patch.depositRequired)
  if (patch.penaltyPrice !== undefined) product.penaltyPrice = round2(patch.penaltyPrice)
  if (patch.saleUnit !== undefined) product.saleUnit = patch.saleUnit
  if (patch.saleType !== undefined) product.saleType = patch.saleType
  if (patch.billingModel !== undefined) product.billingModel = patch.billingModel
  if (patch.durationUnit !== undefined) product.durationUnit = patch.durationUnit
  if (patch.emoji !== undefined) product.emoji = patch.emoji
  if (patch.stationId !== undefined) product.stationId = patch.stationId || null
  if (patch.kioskId !== undefined) product.kioskId = patch.kioskId || null
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
