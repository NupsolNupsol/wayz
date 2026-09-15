import { logger } from '../../config/logger.js'
import { runInTenant, type TenantContext } from '../../platform/tenantContext.js'
import { createRoleDefinition } from '../../services/roleDefinition.service.js'
import { createActivity, publishActivity, saveDraft } from '../../services/activity.service.js'
import { WIQAR_ROLES } from './roles.js'
import {
  WIQAR_ACTIVITIES,
  WIQAR_AREAS,
  WIQAR_LOCATIONS,
  WIQAR_RESOURCE_KINDS,
  WIQAR_RETAIL,
  WIQAR_SITE,
  WIQAR_TERMINALS,
  type WiqarActivity,
} from './config.js'

/**
 * Builds WIQAR's business inside a freshly provisioned WIQAR tenant.
 *
 * Runs **after** generic provisioning, never as part of it. The platform gives every tenant a
 * database, an administrator and one administrator job; this configures one particular
 * company the way its own requirements describe.
 *
 * That separation is the architecture rather than a tidiness preference: a future tenant runs
 * the generic path and then either its own module like this one, or nothing at all and an
 * administrator who builds it through the screens. Neither inherits WAYZ's business, and
 * neither inherits WIQAR's.
 *
 * Everything is written through the **real services** — `createRoleDefinition`,
 * `createActivity`, `publishActivity`. A configuration built by a path nobody else uses proves
 * nothing about the product.
 *
 * Idempotent throughout: anything already present is left exactly as it is, including edits
 * the tenant has made. Re-running must never quietly undo somebody's work.
 */

export interface WiqarProvisionReport {
  roles: number
  sites: number
  areas: number
  terminals: number
  resourceKinds: number
  resources: number
  activities: number
  products: number
}

/* -------------------------------------------------------------------------------------- */
/* Identifiers                                                                               */
/*                                                                                           */
/* Derived, never searched for. An earlier draft of this file found an activity's areas by    */
/* regular expression against a code column, which is the kind of thing that works until      */
/* somebody renames an area. Every id below is a pure function of the configuration, so the   */
/* graph can be wired up without querying for anything.                                       */
/* -------------------------------------------------------------------------------------- */

/*
 * Three locations, three sites.
 *
 * §3.2 describes three locations with the same seven areas replicated at each. An earlier
 * draft modelled them as one site whose area names carried the location as a prefix, which
 * reads the same on a screen and is not the same thing at all: location is the boundary that
 * decides who may touch which animal, and a boundary that exists only inside a display name
 * cannot be enforced. A trainer at Al-Jihfa is scoped to Al-Jihfa because Al-Jihfa is a site.
 */
const siteId = (location: string) => `site_wiqar_${location}`
const areaId = (location: string, area: string) => `stn_wiqar_${location}_${area}`
const terminalId = (location: string, terminal: string) => `ksk_wiqar_${location}_${terminal}`
const resourceKindId = (kind: string) => `at_wiqar_${kind}`
const resourceId = (kind: string, location: string, n: number) => `unit_wiqar_${kind}_${location}_${n}`
const productId = (key: string) => `pr_wiqar_${key}`

/** Every area, at every location, that this activity runs in. */
const areasFor = (activity: WiqarActivity): string[] =>
  WIQAR_LOCATIONS.flatMap((l) => activity.areas.map((a) => areaId(l.key, a)))

/** All three locations — an activity offered at each of them. */
const sitesFor = (): string[] => WIQAR_LOCATIONS.map((l) => siteId(l.key))

/** Every counter that may sell it — the ones that are not retail-only. */
const terminalsFor = (): string[] =>
  WIQAR_LOCATIONS.flatMap((l) =>
    WIQAR_TERMINALS.filter((t) => !t.retailOnly).map((t) => terminalId(l.key, t.key)),
  )

/* -------------------------------------------------------------------------------------- */
/* The stages                                                                                */
/* -------------------------------------------------------------------------------------- */

/** WIQAR's jobs, from its own requirements. See `roles.ts`. */
async function buildRoles(ctx: TenantContext): Promise<number> {
  const { RoleDefinition } = ctx.models
  const present = new Set(
    (await RoleDefinition.find({ tenantId: ctx.tenantId }, { key: 1 }).lean()).map((r) => r.key as string),
  )

  let created = 0
  for (const template of WIQAR_ROLES) {
    if (present.has(template.key)) continue
    // The two jobs the specification gives unrestricted access are system jobs: the tenant
    // should not be able to stand down the only thing that can administer it.
    await createRoleDefinition(ctx.tenantId, template, template.baseRole === 'TENANT_ADMIN')
    created += 1
  }
  return created
}

/**
 * One season, three locations, the same seven areas and three counters at each.
 *
 * §3.2: "replicated identically at Al-Jihfa and Wadi al-Qahah". The hierarchy is the
 * platform's generic Site → Area → Terminal; what those are called is WIQAR's.
 */
async function buildEstate(ctx: TenantContext): Promise<Pick<WiqarProvisionReport, 'sites' | 'areas' | 'terminals'>> {
  const { Site, Station, Kiosk } = ctx.models
  const report = { sites: 0, areas: 0, terminals: 0 }

  const existingSites = new Set(
    (await Site.find({ tenantId: ctx.tenantId }, { _id: 1 }).lean()).map((s) => String(s._id)),
  )
  const existingAreas = new Set(
    (await Station.find({ tenantId: ctx.tenantId }, { _id: 1 }).lean()).map((s) => String(s._id)),
  )
  const existingTerminals = new Set(
    (await Kiosk.find({ tenantId: ctx.tenantId }, { _id: 1 }).lean()).map((k) => String(k._id)),
  )

  for (const location of WIQAR_LOCATIONS) {
    const site = siteId(location.key)
    if (!existingSites.has(site)) {
      await Site.create({
        _id: site,
        tenantId: ctx.tenantId,
        name: `${WIQAR_SITE.name} — ${location.name}`,
        nameAr: `${WIQAR_SITE.nameAr} — ${location.nameAr}`,
        city: location.city,
        active: true,
      })
      report.sites += 1
    }

    for (const area of WIQAR_AREAS) {
      const id = areaId(location.key, area.key)
      if (existingAreas.has(id)) continue

      await Station.create({
        _id: id,
        tenantId: ctx.tenantId,
        siteId: site,
        zoneId: null,
        // The location still leads the name, because that is how WIQAR's people say where they
        // are — "the equestrian track at Al-Jihfa" — and a list of twenty-one areas is
        // unreadable without it.
        name: `${location.name} — ${area.name}`,
        nameAr: `${location.nameAr} — ${area.nameAr}`,
        code: `${location.key}-${area.key}`,
        // No built-in engines. WIQAR runs activities it defined itself, and naming one of the
        // platform's here is exactly the inheritance this refactor removes.
        engineKinds: [],
        activityKeys: WIQAR_ACTIVITIES.filter((a) => a.areas.includes(area.key)).map((a) => a.key),
        active: true,
      })
      report.areas += 1
    }

    for (const terminal of WIQAR_TERMINALS) {
      const id = terminalId(location.key, terminal.key)
      if (existingTerminals.has(id)) continue

      await Kiosk.create({
        _id: id,
        tenantId: ctx.tenantId,
        siteId: site,
        stationId: areaId(location.key, terminal.area),
        name: `${location.name} — ${terminal.name}`,
        nameAr: `${location.nameAr} — ${terminal.nameAr}`,
        code: `${location.key}-${terminal.key}`,
        engineKind: null,
        // A retail counter sells products, not experiences — §3.2's changing-room shops.
        activityKeys: terminal.retailOnly ? [] : WIQAR_ACTIVITIES.map((a) => a.key),
        isExitGate: false,
        active: true,
      })
      report.terminals += 1
    }
  }

  return report
}

/** The animals, from §7.1, each with an identifier of its own and a home area. */
async function buildResources(ctx: TenantContext): Promise<Pick<WiqarProvisionReport, 'resourceKinds' | 'resources'>> {
  const { AssetType, AssetUnit } = ctx.models
  const report = { resourceKinds: 0, resources: 0 }

  const existingKinds = new Set(
    (await AssetType.find({ tenantId: ctx.tenantId }, { _id: 1 }).lean()).map((t) => String(t._id)),
  )
  const existingUnits = new Set(
    (await AssetUnit.find({ tenantId: ctx.tenantId }, { _id: 1 }).lean()).map((u) => String(u._id)),
  )

  for (const kind of WIQAR_RESOURCE_KINDS) {
    const typeId = resourceKindId(kind.key)
    if (!existingKinds.has(typeId)) {
      await AssetType.create({
        _id: typeId,
        tenantId: ctx.tenantId,
        name: kind.name,
        nameAr: kind.nameAr,
        kind: 'RESOURCE',
        engineKind: null,
        capacity: { seats: 1 },
        active: true,
      })
      report.resourceKinds += 1
    }

    for (const location of WIQAR_LOCATIONS) {
      for (let n = 1; n <= kind.countPerLocation; n += 1) {
        const id = resourceId(kind.key, location.key, n)
        if (existingUnits.has(id)) continue

        await AssetUnit.create({
          _id: id,
          tenantId: ctx.tenantId,
          assetTypeId: typeId,
          identifier: `${kind.identifierPrefix}-${location.key.slice(0, 3).toUpperCase()}-${String(n).padStart(3, '0')}`,
          // The area it lives in — the stable, the paddock, the animal village.
          stationId: areaId(location.key, kind.area),
          assetAreaId: `area_${ctx.tenantId}_1`,
          kioskId: null,
          gateId: null,
          status: 'AVAILABLE',
          currentBookingId: null,
        })
        report.resources += 1
      }
    }
  }

  return report
}

/** §4.2 — the changing-room catalogue, the same at every location. */
async function buildCatalogue(ctx: TenantContext): Promise<number> {
  const { CatalogueProduct } = ctx.models
  const present = new Set(
    (await CatalogueProduct.find({ tenantId: ctx.tenantId }, { _id: 1 }).lean()).map((p) => String(p._id)),
  )

  let created = 0
  for (const product of WIQAR_RETAIL) {
    const id = productId(product.key)
    if (present.has(id)) continue

    await CatalogueProduct.create({
      _id: id,
      tenantId: ctx.tenantId,
      name: product.name,
      nameAr: product.nameAr,
      category: product.category,
      basePrice: product.price,
      saleUnit: 'ITEM',
      saleType: 'SALE',
      billingModel: 'PACKAGE',
      engineKind: null,
      assetTypeId: null,
      active: true,
    })
    created += 1
  }
  return created
}

/**
 * §4.1 — the experiences, wired into the graph and published.
 *
 * Each is created through `createActivity`, shaped through `saveDraft` and frozen through
 * `publishActivity` — the same three calls a manager's clicks make. The relationships are
 * derived from the configuration rather than looked up, so this cannot be broken by a rename.
 */
async function buildActivities(ctx: TenantContext): Promise<number> {
  const { ActivityDefinition } = ctx.models
  const present = new Set(
    (await ActivityDefinition.find({ tenantId: ctx.tenantId }, { key: 1 }).lean()).map((a) => a.key as string),
  )

  const terminals = terminalsFor()
  let created = 0

  for (const spec of WIQAR_ACTIVITIES) {
    if (present.has(spec.key)) continue

    const definition = await createActivity(
      ctx.tenantId,
      { key: spec.key, name: spec.name, nameAr: spec.nameAr, description: spec.description, emoji: spec.emoji },
      'wiqar-provisioning',
    )

    await saveDraft(ctx.tenantId, definition._id, {
      siteIds: sitesFor(),
      areaIds: areasFor(spec),
      terminalIds: terminals,
      operatorRoleKeys: spec.operatorRoles,
      assetTypeIds: spec.resourceKinds.map(resourceKindId),
      pricing: {
        billingModel: 'PACKAGE',
        saleUnit: 'TOUR',
        basePrice: spec.price,
        durationUnit: null,
        depositRequired: 0,
        overtimeHourlyRate: null,
        gracePeriodMin: 10,
      },
      // A group package is sold to a party; everything else seats one visitor per booking.
      capacity: { seatsPerBooking: spec.minParty > 1 ? null : 1, maxConcurrent: null },
    })

    await publishActivity(ctx.tenantId, definition._id, 'wiqar-provisioning', `${spec.code} — initial configuration`)
    created += 1
  }

  return created
}

/**
 * The whole domain, in one tenant context.
 *
 * Entered once rather than per stage: each `runInTenant` resolves the registry and binds
 * thirty-three models, and doing that fifteen times to create fifteen roles is work for
 * nothing.
 */
export async function provisionWiqarDomain(tenantId: string): Promise<WiqarProvisionReport> {
  const report = await runInTenant(tenantId, async (ctx) => {
    const roles = await buildRoles(ctx)
    const estate = await buildEstate(ctx)
    const resources = await buildResources(ctx)
    const products = await buildCatalogue(ctx)
    const activities = await buildActivities(ctx)

    return { roles, ...estate, ...resources, products, activities }
  })

  logger.info('WIQAR domain provisioned', report)
  return report
}
