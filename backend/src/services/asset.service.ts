import { nanoid } from 'nanoid'
import { AssetType, AssetUnit, Booking, CatalogueProduct, Kiosk, Station } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'
import { recordAudit } from './audit.service.js'
import type { AssetUnitStatus, BagCategory, BillingModel, EngineKind, Role, SaleType, SaleUnit } from '../domain/types.js'
import { canWorkEngine, engineFilter } from '../domain/access.js'
import { tenantRules } from './rules.service.js'
import type { Scope } from '../interfaces/index.js'
import { FLOOR_LEADS } from '../domain/roles.js'
import { raise } from './notification.service.js'

export interface AssetScope {
  tenantId: string
  userId: string
  role: Role
  engineKinds?: EngineKind[]
}

function assertOwns(scope: AssetScope, engineKind: EngineKind) {
  if (!canWorkEngine({ role: scope.role, engineKinds: scope.engineKinds }, engineKind)) {
    throw ApiError.forbidden('You are not assigned to that activity.')
  }
}

async function assertOwnsType(scope: AssetScope, assetTypeId: string) {
  const type = await AssetType.findOne({ _id: assetTypeId, tenantId: scope.tenantId }, { engineKind: 1 }).lean()
  if (!type) throw ApiError.notFound('Asset not found.')
  assertOwns(scope, type.engineKind)
}

export const SETTABLE_STATUSES: AssetUnitStatus[] = ['AVAILABLE', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED']

export const ASSET_KINDS = ['COMPARTMENT', 'VEHICLE', 'TABLE', 'BOAT', 'ANIMAL'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

const KIND_DEFAULTS: Record<AssetKind, { billingModel: BillingModel; emoji: string }> = {
  COMPARTMENT: { billingModel: 'PER_COMPARTMENT', emoji: '🗄️' },
  VEHICLE: { billingModel: 'DURATION_BASED', emoji: '🛴' },
  BOAT: { billingModel: 'DURATION_BASED', emoji: '⛵' },
  TABLE: { billingModel: 'PACKAGE', emoji: '🍽️' },
  ANIMAL: { billingModel: 'PACKAGE', emoji: '🐪' },
}

const SALE_UNIT_DEFAULTS: Record<AssetKind, SaleUnit> = {
  COMPARTMENT: 'BAG',
  VEHICLE: 'HOUR',
  BOAT: 'TOUR',
  TABLE: 'ITEM',
  ANIMAL: 'TOUR',
}

const SALE_TYPE_DEFAULTS: Record<AssetKind, SaleType> = {
  COMPARTMENT: 'SALE',
  VEHICLE: 'RENTAL',
  BOAT: 'RENTAL',
  TABLE: 'RENTAL',
  ANIMAL: 'RENTAL',
}

const BUSY: AssetUnitStatus[] = ['HELD', 'RESERVED', 'OCCUPIED', 'RETRIEVAL_PENDING']

const round2 = (n: number) => Math.round(n * 100) / 100

function bucket(statuses: Record<string, number>) {
  const total = Object.values(statuses).reduce((a, b) => a + b, 0)
  const inUse = (statuses.OCCUPIED ?? 0) + (statuses.RESERVED ?? 0) + (statuses.HELD ?? 0) + (statuses.RETRIEVAL_PENDING ?? 0)
  const outOfService =
    (statuses.MAINTENANCE ?? 0) + (statuses.OUT_OF_SERVICE ?? 0) + (statuses.BLOCKED ?? 0) + (statuses.INSPECTION_REQUIRED ?? 0)
  return {
    total,
    inUse,
    available: statuses.AVAILABLE ?? 0,
    outOfService,
    utilisationPct: total ? Math.round((inUse / total) * 100) : 0,
  }
}

async function productFor(tenantId: string, assetTypeId: string) {
  return CatalogueProduct.findOne({ tenantId, assetTypeId }).sort({ basePrice: 1, _id: 1 }).lean()
}

export async function listAssetTypes(scope: AssetScope, engineKind?: EngineKind) {
  const match: Record<string, unknown> = { tenantId: scope.tenantId }
  const engines = engineFilter({ role: scope.role, engineKinds: scope.engineKinds }, engineKind)
  if (engines !== undefined) match.engineKind = engines

  const [types, unitAgg, products, unitStations] = await Promise.all([
    AssetType.find(match).sort({ engineKind: 1, name: 1 }).lean(),
    AssetUnit.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $group: { _id: { assetTypeId: '$assetTypeId', status: '$status' }, count: { $sum: 1 } } },
    ]),
    CatalogueProduct.find({ tenantId: scope.tenantId, assetTypeId: { $ne: null } }).lean(),
    AssetUnit.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $group: { _id: { assetTypeId: '$assetTypeId', stationId: '$stationId' }, count: { $sum: 1 } } },
    ]),
  ])

  const byType = new Map<string, Record<string, number>>()
  for (const row of unitAgg as { _id: { assetTypeId: string; status: string }; count: number }[]) {
    const entry = byType.get(row._id.assetTypeId) ?? {}
    entry[row._id.status] = row.count
    byType.set(row._id.assetTypeId, entry)
  }

  const stationsByType = new Map<string, string[]>()
  for (const row of unitStations as { _id: { assetTypeId: string; stationId: string } }[]) {
    const list = stationsByType.get(row._id.assetTypeId) ?? []
    list.push(row._id.stationId)
    stationsByType.set(row._id.assetTypeId, list)
  }

  const productByType = new Map<string, (typeof products)[number]>()
  for (const product of [...products].sort((a, b) => a.basePrice - b.basePrice || a._id.localeCompare(b._id))) {
    if (!product.assetTypeId || productByType.has(product.assetTypeId)) continue
    productByType.set(product.assetTypeId, product)
  }
  const stations = await Station.find({ tenantId: scope.tenantId }).lean()
  const stationName = new Map(stations.map((s) => [s._id, s.name]))

  return {
    stations: stations.map((s) => ({ _id: s._id, name: s.name, engineKinds: s.engineKinds })),
    assetTypes: types.map((type) => {
      const statuses = byType.get(type._id) ?? {}
      const product = productByType.get(type._id)
      return {
        _id: type._id,
        name: type.name,
        kind: type.kind,
        engineKind: type.engineKind,
        capacityScore: type.capacity?.capacityScore ?? 0,
        seats: type.capacity?.seats ?? null,
        productId: product?._id ?? null,
        productName: product?.name ?? null,
        basePrice: product?.basePrice ?? null,
        saleUnit: product?.saleUnit ?? null,
        saleType: product?.saleType ?? null,
        depositRequired: product?.depositRequired ?? null,
        penaltyPrice: product?.penaltyPrice ?? null,
        overtimeHourlyRate: product?.overtimeHourlyRate ?? null,
        billingModel: product?.billingModel ?? null,
        stationNames: [...new Set(stationsByType.get(type._id) ?? [])].map((id) => stationName.get(id) ?? id),
        byStatus: statuses,
        ...bucket(statuses),
      }
    }),
  }
}

export async function assetTypeDetail(scope: AssetScope, assetTypeId: string) {
  const type = await AssetType.findOne({ _id: assetTypeId, tenantId: scope.tenantId }).lean()
  if (!type) throw ApiError.notFound('Asset type not found.')
  assertOwns(scope, type.engineKind)

  const [units, product, stations, kiosks] = await Promise.all([
    AssetUnit.find({ tenantId: scope.tenantId, assetTypeId }).sort({ identifier: 1 }).limit(2000).lean(),
    productFor(scope.tenantId, assetTypeId),
    Station.find({ tenantId: scope.tenantId }).lean(),
    Kiosk.find({ tenantId: scope.tenantId }).lean(),
  ])

  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  const kioskName = new Map(kiosks.map((k) => [k._id, k.name]))
  const statuses: Record<string, number> = {}
  for (const u of units) statuses[u.status] = (statuses[u.status] ?? 0) + 1

  const bookingIds = units.map((u) => u.currentBookingId).filter((id): id is string => !!id)
  const bookings = bookingIds.length
    ? await Booking.find({ _id: { $in: bookingIds } }, { _id: 1, ref: 1 }).lean()
    : []
  const bookingRef = new Map(bookings.map((b) => [b._id, b.ref]))

  return {
    assetType: {
      _id: type._id,
      name: type.name,
      kind: type.kind,
      engineKind: type.engineKind,
      capacity: type.capacity ?? {},
      productId: product?._id ?? null,
      productName: product?.name ?? null,
      basePrice: product?.basePrice ?? null,
      saleUnit: product?.saleUnit ?? null,
      saleType: product?.saleType ?? null,
      depositRequired: product?.depositRequired ?? null,
      penaltyPrice: product?.penaltyPrice ?? null,
      overtimeHourlyRate: product?.overtimeHourlyRate ?? null,
      billingModel: product?.billingModel ?? null,
      ...bucket(statuses),
    },
    stations: stations.map((s) => ({ _id: s._id, name: s.name, engineKinds: s.engineKinds })),
    kiosks: kiosks.map((k) => ({ _id: k._id, name: k.name, stationId: k.stationId })),
    units: units.map((u) => ({
      _id: u._id,
      identifier: u.identifier,
      status: u.status,
      stationId: u.stationId,
      stationName: stationName.get(u.stationId) ?? u.stationId,
      kioskId: u.kioskId,
      kioskName: u.kioskId ? (kioskName.get(u.kioskId) ?? u.kioskId) : null,
      note: u.note ?? '',
      priceOverride: u.priceOverride ?? null,
      effectivePrice: u.priceOverride ?? product?.basePrice ?? null,
      penaltyPrice: u.penaltyPrice ?? null,
      effectivePenalty: u.penaltyPrice ?? product?.penaltyPrice ?? null,
      currentBookingId: u.currentBookingId,
      currentBookingRef: u.currentBookingId ? (bookingRef.get(u.currentBookingId) ?? null) : null,
    })),
  }
}

export async function unitReturnPosition(scope: Scope, unitId: string) {
  const unit = await AssetUnit.findOne({ _id: unitId, tenantId: scope.tenantId }).lean()
  if (!unit) throw ApiError.notFound('Asset not found.')

  const [type, kiosk, rules] = await Promise.all([
    AssetType.findOne({ _id: unit.assetTypeId, tenantId: scope.tenantId }).lean(),
    unit.kioskId ? Kiosk.findOne({ _id: unit.kioskId, tenantId: scope.tenantId }).lean() : null,
    tenantRules(scope.tenantId),
  ])

  const myDesk = scope.kioskId ?? null
  const belongsHere = !myDesk || !unit.kioskId || unit.kioskId === myDesk

  const booking = unit.currentBookingId
    ? await Booking.findOne({ _id: unit.currentBookingId, tenantId: scope.tenantId }).lean()
    : null
  const live = !!booking && ['ACTIVE', 'OVERTIME'].includes(booking.status)

  return {
    unitId: unit._id,
    identifier: unit.identifier,
    assetTypeName: type?.name ?? unit.assetTypeId,
    engineKind: type?.engineKind ?? null,
    status: unit.status,
    homeKioskId: unit.kioskId,
    homeKioskName: kiosk?.name ?? null,
    belongsHere,
    booking: live && booking ? { id: booking._id, ref: booking.ref, customerName: booking.customerName, status: booking.status } : null,
    wrongDeskPenalty: belongsHere ? 0 : rules.rental.wrongStationPenalty,
    currency: undefined as string | undefined,
  }
}

export async function assetUnitDetail(scope: AssetScope, unitId: string) {
  const unit = await AssetUnit.findOne({ _id: unitId, tenantId: scope.tenantId }).lean()
  if (!unit) throw ApiError.notFound('Asset not found.')
  await assertOwnsType(scope, unit.assetTypeId)

  const [type, product, station, kiosk, booking] = await Promise.all([
    AssetType.findOne({ _id: unit.assetTypeId, tenantId: scope.tenantId }).lean(),
    productFor(scope.tenantId, unit.assetTypeId),
    Station.findOne({ _id: unit.stationId, tenantId: scope.tenantId }).lean(),
    unit.kioskId ? Kiosk.findOne({ _id: unit.kioskId, tenantId: scope.tenantId }).lean() : null,
    unit.currentBookingId ? Booking.findOne({ _id: unit.currentBookingId, tenantId: scope.tenantId }).lean() : null,
  ])

  return {
    _id: unit._id,
    identifier: unit.identifier,
    status: unit.status,
    note: unit.note ?? '',
    priceOverride: unit.priceOverride ?? null,
    effectivePrice: unit.priceOverride ?? product?.basePrice ?? null,
    penaltyPrice: unit.penaltyPrice ?? null,
    effectivePenalty: unit.penaltyPrice ?? product?.penaltyPrice ?? null,
    assetTypeId: unit.assetTypeId,
    assetTypeName: type?.name ?? unit.assetTypeId,
    assetTypeKind: type?.kind ?? null,
    engineKind: type?.engineKind ?? null,
    stationId: unit.stationId,
    stationName: station?.name ?? unit.stationId,
    kioskId: unit.kioskId,
    kioskName: kiosk?.name ?? null,
    basePrice: product?.basePrice ?? null,
    currentBookingId: unit.currentBookingId,
    currentBookingRef: booking?.ref ?? null,
    currentBookingStatus: booking?.status ?? null,
  }
}

export interface NewAssetKind {
  name: string
  engineKind: EngineKind
  kind: AssetKind
  basePrice: number
  saleUnit?: SaleUnit
  saleType?: SaleType
  depositRequired?: number
  penaltyPrice?: number
  overtimeHourlyRate?: number | null
  billingModel?: BillingModel
  capacity?: {
    internalDimensions?: { w: number; h: number; d: number }
    maxWeight?: number
    maxRecommendedBagCount?: number
    compatibleBagCategories?: BagCategory[]
    capacityScore?: number
    seats?: number
  }
  initialCount?: number
  stationId?: string
  kioskId?: string | null
}

export async function createAssetKind(scope: AssetScope, input: NewAssetKind) {
  assertOwns(scope, input.engineKind)
  const name = input.name.trim()
  if (name.length < 2) throw ApiError.badRequest('Give the kind a name.')

  const clash = await AssetType.findOne({ tenantId: scope.tenantId, name }).lean()
  if (clash) throw ApiError.badRequest(`${name} already exists in this tenant.`)

  const defaults = KIND_DEFAULTS[input.kind]
  const capacity = input.capacity ?? {}
  const assetTypeId = await nextId('assetType')

  await AssetType.create({
    _id: assetTypeId,
    tenantId: scope.tenantId,
    engineKind: input.engineKind,
    name,
    kind: input.kind,
    capacity: {
      ...capacity,
      capacityScore: capacity.capacityScore ?? capacity.maxRecommendedBagCount ?? capacity.seats ?? 1,
    },
  })

  const product = await CatalogueProduct.create({
    _id: await nextId('product'),
    tenantId: scope.tenantId,
    engineKind: input.engineKind,
    name,
    category: 'General',
    basePrice: round2(input.basePrice),
    saleUnit: input.saleUnit ?? SALE_UNIT_DEFAULTS[input.kind],
    saleType: input.saleType ?? SALE_TYPE_DEFAULTS[input.kind],
    depositRequired: round2(input.depositRequired ?? 0),
    penaltyPrice: round2(input.penaltyPrice ?? 0),
    overtimeHourlyRate: input.overtimeHourlyRate == null ? null : round2(input.overtimeHourlyRate),
    assetTypeId,
    billingModel: input.billingModel ?? defaults.billingModel,
    durationUnit: (input.billingModel ?? defaults.billingModel) === 'DURATION_BASED' ? 'HOUR' : undefined,
    compatibleBagCategories: capacity.compatibleBagCategories,
    emoji: defaults.emoji,
    active: true,
  })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'ASSET_KIND_CREATED',
    entity: 'Asset',
    entityId: assetTypeId,
    detail: `${name} · ${input.kind} · ${input.engineKind} at ${round2(input.basePrice)}`,
  })

  let provisioned = 0
  if (input.initialCount && input.stationId) {
    const added = await addUnits(scope, assetTypeId, {
      stationId: input.stationId,
      kioskId: input.kioskId ?? null,
      count: input.initialCount,
    })
    provisioned = added.created
  }

  return { _id: assetTypeId, name, productId: product._id, provisioned }
}

export async function updateAssetKind(
  scope: AssetScope,
  assetTypeId: string,
  input: { name?: string; capacity?: NewAssetKind['capacity'] },
) {
  const type = await AssetType.findOne({ _id: assetTypeId, tenantId: scope.tenantId })
  if (!type) throw ApiError.notFound('Asset kind not found.')
  assertOwns(scope, type.engineKind)

  const changes: string[] = []
  if (input.name !== undefined && input.name.trim() && input.name.trim() !== type.name) {
    const name = input.name.trim()
    const clash = await AssetType.findOne({ tenantId: scope.tenantId, name, _id: { $ne: type._id } }).lean()
    if (clash) throw ApiError.badRequest(`${name} already exists in this tenant.`)
    changes.push(`name ${type.name} → ${name}`)
    await CatalogueProduct.updateOne({ tenantId: scope.tenantId, assetTypeId }, { $set: { name } })
    type.name = name
  }

  if (input.capacity) {
    type.capacity = {
      ...type.capacity,
      ...input.capacity,
      capacityScore: input.capacity.capacityScore ?? type.capacity?.capacityScore ?? 1,
    }
    type.markModified('capacity')
    changes.push('capacity updated')
  }

  await type.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'ASSET_KIND_UPDATED',
    entity: 'Asset',
    entityId: type._id,
    detail: `${type.name}: ${changes.join(', ') || 'no change'}`,
  })

  return { _id: type._id, name: type.name }
}

export async function removeAssetKind(scope: AssetScope, assetTypeId: string) {
  const type = await AssetType.findOne({ _id: assetTypeId, tenantId: scope.tenantId }).lean()
  if (!type) throw ApiError.notFound('Asset kind not found.')
  assertOwns(scope, type.engineKind)

  const units = await AssetUnit.countDocuments({ tenantId: scope.tenantId, assetTypeId })
  if (units > 0) {
    throw ApiError.unprocessable(`${type.name} still has ${units} asset(s). Remove them before deleting the kind.`)
  }

  await Promise.all([
    AssetType.deleteOne({ _id: assetTypeId, tenantId: scope.tenantId }),
    CatalogueProduct.updateMany({ tenantId: scope.tenantId, assetTypeId }, { $set: { active: false, assetTypeId: null } }),
  ])

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'ASSET_KIND_REMOVED',
    entity: 'Asset',
    entityId: assetTypeId,
    detail: `${type.name} removed; its product was retired`,
  })

  return { removed: assetTypeId, name: type.name }
}

export async function addUnits(
  scope: AssetScope,
  assetTypeId: string,
  input: { stationId: string; kioskId?: string | null; count: number; identifierPrefix?: string },
) {
  const [type, station] = await Promise.all([
    AssetType.findOne({ _id: assetTypeId, tenantId: scope.tenantId }).lean(),
    Station.findOne({ _id: input.stationId, tenantId: scope.tenantId }).lean(),
  ])
  if (!type) throw ApiError.notFound('Asset type not found.')
  if (!station) throw ApiError.notFound('Station not found.')
  assertOwns(scope, type.engineKind)
  if (input.count < 1 || input.count > 200) throw ApiError.badRequest('Add between 1 and 200 assets at a time.')

  if (input.kioskId) {
    const kiosk = await Kiosk.findOne({ _id: input.kioskId, tenantId: scope.tenantId, stationId: input.stationId }).lean()
    if (!kiosk) throw ApiError.badRequest('That kiosk does not belong to the chosen station.')
    if (kiosk.engineKind !== type.engineKind) {
      throw ApiError.badRequest(`${kiosk.name} runs ${kiosk.engineKind.replaceAll('_', ' ').toLowerCase()}, so it cannot hold ${type.name}.`)
    }
  }

  const prefix =
    (input.identifierPrefix ?? '').trim().toUpperCase() ||
    type.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() ||
    'UNIT'

  const existing = await AssetUnit.find({ tenantId: scope.tenantId, assetTypeId }, { identifier: 1 }).lean()
  const taken = new Set(existing.map((u) => u.identifier))

  const units: Record<string, unknown>[] = []
  let n = existing.length
  while (units.length < input.count) {
    n += 1
    const identifier = `${prefix}-${String(n).padStart(2, '0')}`
    if (taken.has(identifier)) continue
    taken.add(identifier)
    units.push({
      _id: `unit_${scope.tenantId}_${assetTypeId}_${nanoid(8)}`,
      tenantId: scope.tenantId,
      stationId: input.stationId,
      kioskId: input.kioskId ?? null,
      assetAreaId: `area_${scope.tenantId}_1`,
      assetTypeId,
      identifier,
      status: 'AVAILABLE' as const,
      currentBookingId: null,
    })
  }

  await AssetUnit.insertMany(units)

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'ASSET_UNITS_ADDED',
    entity: 'Asset',
    entityId: assetTypeId,
    detail: `${units.length} × ${type.name} added at ${station.name}`,
  })

  return { created: units.length, assetTypeId, identifiers: units.map((u) => u.identifier as string) }
}

export async function updateUnit(
  scope: AssetScope,
  unitId: string,
  input: {
    status?: AssetUnitStatus
    note?: string
    priceOverride?: number | null
    penaltyPrice?: number | null
    identifier?: string
    stationId?: string
    kioskId?: string | null
  },
) {
  const unit = await AssetUnit.findOne({ _id: unitId, tenantId: scope.tenantId })
  if (!unit) throw ApiError.notFound('Asset not found.')
  await assertOwnsType(scope, unit.assetTypeId)

  const changes: string[] = []

  if (input.status && input.status !== unit.status) {
    if (!SETTABLE_STATUSES.includes(input.status)) {
      throw ApiError.badRequest(`${input.status} is set by the workflow, not by hand.`)
    }
    if (input.status !== 'AVAILABLE' && BUSY.includes(unit.status)) {
      throw ApiError.unprocessable(`${unit.identifier} is in use — complete or reassign its booking first.`)
    }
    changes.push(`status ${unit.status} → ${input.status}`)
    unit.status = input.status
    if (input.status === 'AVAILABLE') unit.currentBookingId = null
  }

  if (input.identifier !== undefined && input.identifier.trim() && input.identifier.trim() !== unit.identifier) {
    const clash = await AssetUnit.findOne({
      tenantId: scope.tenantId,
      assetTypeId: unit.assetTypeId,
      identifier: input.identifier.trim(),
      _id: { $ne: unit._id },
    }).lean()
    if (clash) throw ApiError.badRequest(`${input.identifier.trim()} is already used by another asset.`)
    changes.push(`identifier ${unit.identifier} → ${input.identifier.trim()}`)
    unit.identifier = input.identifier.trim()
  }

  if (input.note !== undefined) unit.note = input.note

  if (input.priceOverride !== undefined) {
    const next = input.priceOverride === null ? null : round2(input.priceOverride)
    if (next !== null && next < 0) throw ApiError.badRequest('A price cannot be negative.')
    changes.push(next === null ? 'price back to the type price' : `price override ${next}`)
    unit.priceOverride = next
  }

  if (input.penaltyPrice !== undefined) {
    const next = input.penaltyPrice === null ? null : round2(input.penaltyPrice)
    if (next !== null && next < 0) throw ApiError.badRequest('A penalty cannot be negative.')
    changes.push(next === null ? 'penalty back to the product penalty' : `penalty ${next}`)
    unit.penaltyPrice = next
  }

  if (input.stationId !== undefined || input.kioskId !== undefined) {
    if (BUSY.includes(unit.status)) {
      throw ApiError.unprocessable(`${unit.identifier} is in use — complete its booking before moving it.`)
    }
    const stationId = input.stationId ?? unit.stationId
    const station = await Station.findOne({ _id: stationId, tenantId: scope.tenantId }).lean()
    if (!station) throw ApiError.badRequest('That station does not exist in this tenant.')

    const type = await AssetType.findOne({ _id: unit.assetTypeId, tenantId: scope.tenantId }, { engineKind: 1 }).lean()
    if (type && !station.engineKinds.includes(type.engineKind)) {
      throw ApiError.badRequest(`${station.name} does not run ${type.engineKind.replaceAll('_', ' ').toLowerCase()}.`)
    }

    const kioskId = input.kioskId === undefined ? unit.kioskId : input.kioskId
    if (kioskId) {
      const kiosk = await Kiosk.findOne({ _id: kioskId, tenantId: scope.tenantId, stationId }).lean()
      if (!kiosk) throw ApiError.badRequest('That kiosk does not belong to the chosen station.')
      if (type && kiosk.engineKind !== type.engineKind) {
        throw ApiError.badRequest(`${kiosk.name} runs ${kiosk.engineKind.replaceAll('_', ' ').toLowerCase()}, so it cannot hold ${unit.identifier}.`)
      }
    }

    if (stationId !== unit.stationId || kioskId !== unit.kioskId) {
      changes.push(`moved to ${station.name}${kioskId ? '' : ' (no desk)'}`)
    }
    unit.stationId = stationId
    unit.kioskId = kioskId
  }

  await unit.save()

  if (input.status && input.status !== 'AVAILABLE' && SETTABLE_STATUSES.includes(input.status)) {
    const type = await AssetType.findOne({ _id: unit.assetTypeId, tenantId: scope.tenantId }).lean()
    await raise({
      tenantId: scope.tenantId,
      stationId: unit.stationId,
      kioskId: unit.kioskId,
      engineKind: type?.engineKind ?? null,
      title: `${type?.name ?? 'Asset'} taken out of service`,
      body: `${unit.identifier} moved to ${input.status.replaceAll('_', ' ').toLowerCase()}.${unit.note ? ` ${unit.note}` : ''}`,
      level: 'warning',
      audience: FLOOR_LEADS,
      link: `/assets/unit/${unit._id}`,
    })
  }

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'ASSET_UNIT_UPDATED',
    entity: 'Asset',
    entityId: unit._id,
    detail: `${unit.identifier}: ${changes.join(', ') || 'note updated'}`,
  })

  return assetUnitDetail(scope, unit._id)
}

export async function removeUnit(scope: AssetScope, unitId: string) {
  const unit = await AssetUnit.findOne({ _id: unitId, tenantId: scope.tenantId })
  if (!unit) throw ApiError.notFound('Asset not found.')
  await assertOwnsType(scope, unit.assetTypeId)
  if (BUSY.includes(unit.status)) {
    throw ApiError.unprocessable(`${unit.identifier} is in use — complete or reassign its booking first.`)
  }
  await unit.deleteOne()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'ASSET_UNIT_REMOVED',
    entity: 'Asset',
    entityId: unit._id,
    detail: `${unit.identifier} removed from the estate`,
  })

  return { removed: unit._id, identifier: unit.identifier }
}

export async function updateTypePrice(
  scope: AssetScope,
  assetTypeId: string,
  input: {
    basePrice?: number
    depositRequired?: number
    penaltyPrice?: number
    saleUnit?: SaleUnit
    saleType?: SaleType
    overtimeHourlyRate?: number | null
    clearOverrides?: boolean
  },
) {
  const type = await AssetType.findOne({ _id: assetTypeId, tenantId: scope.tenantId }).lean()
  if (!type) throw ApiError.notFound('Asset type not found.')
  assertOwns(scope, type.engineKind)

  const product = await CatalogueProduct.findOne({ tenantId: scope.tenantId, assetTypeId })
  if (!product) throw ApiError.unprocessable(`${type.name} has no product to price. Create one under Pricing first.`)

  const changes: string[] = []
  if (input.basePrice !== undefined) {
    if (input.basePrice < 0) throw ApiError.badRequest('A price cannot be negative.')
    changes.push(`price ${product.basePrice} → ${round2(input.basePrice)}`)
    product.basePrice = round2(input.basePrice)
  }
  if (input.depositRequired !== undefined) {
    if (input.depositRequired < 0) throw ApiError.badRequest('A deposit cannot be negative.')
    changes.push(`deposit ${product.depositRequired} → ${round2(input.depositRequired)}`)
    product.depositRequired = round2(input.depositRequired)
  }
  if (input.penaltyPrice !== undefined) {
    if (input.penaltyPrice < 0) throw ApiError.badRequest('A penalty cannot be negative.')
    changes.push(`penalty ${product.penaltyPrice ?? 0} → ${round2(input.penaltyPrice)}`)
    product.penaltyPrice = round2(input.penaltyPrice)
  }
  if (input.saleUnit !== undefined) {
    changes.push(`unit ${product.saleUnit} → ${input.saleUnit}`)
    product.saleUnit = input.saleUnit
  }
  if (input.saleType !== undefined) {
    changes.push(`sale type ${product.saleType} → ${input.saleType}`)
    product.saleType = input.saleType
  }
  if (input.overtimeHourlyRate !== undefined) {
    const next = input.overtimeHourlyRate === null ? null : round2(input.overtimeHourlyRate)
    if (next !== null && next < 0) throw ApiError.badRequest('An overtime rate cannot be negative.')
    changes.push(`overtime ${product.overtimeHourlyRate ?? '—'} → ${next ?? '—'}`)
    product.overtimeHourlyRate = next
  }
  await product.save()

  let cleared = 0
  if (input.clearOverrides) {
    const res = await AssetUnit.updateMany(
      { tenantId: scope.tenantId, assetTypeId, priceOverride: { $ne: null } },
      { $set: { priceOverride: null } },
    )
    cleared = res.modifiedCount ?? 0
    if (cleared) changes.push(`${cleared} unit override(s) cleared`)
  }

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'ASSET_TYPE_PRICED',
    entity: 'Asset',
    entityId: assetTypeId,
    detail: `${type.name}: ${changes.join(', ')}`,
  })

  return { assetTypeId, productId: product._id, basePrice: product.basePrice, cleared }
}
