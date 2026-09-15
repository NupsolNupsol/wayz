import { ActivityDefinition, AssetUnit, Station } from '../models/index.js'
import type { ActivityDefinitionDoc } from '../models/index.js'
import type { EffectiveAccess } from './authorisation.service.js'

/**
 * Which resources a person may actually see and use.
 *
 * This replaces the assumption that resource access follows one of three built-in engines:
 *
 * ```ts
 * if (engine === 'MOBILITY') → vehicles
 * if (engine === 'LAGOON')   → boats
 * ```
 *
 * That is a fact about one tenant written into generic code. It cannot express "the six calm
 * horses eligible for a beginners' ride at South of 'Usfan", and it gives a company that runs
 * horse tours nothing at all.
 *
 * The rule now, and it is the same rule for every tenant:
 *
 * ```
 * visible resources = tenant
 *                   ∩ permission to see resources at all
 *                   ∩ the locations this person is posted to
 *                   ∩ the resources the activities they work are allowed to use
 * ```
 *
 * Nothing in it names an engine, an activity or a company. A horse trainer at one WIQAR
 * location and a scooter agent at a WAYZ gate are computed by the same code, and the answer
 * differs only because their tenant's configuration differs.
 */

export interface ResourceQuery {
  /** A Mongo filter fragment, ready to spread into a query. */
  filter: Record<string, unknown>
  /** Why it came out this way — for the screens that explain an empty list. */
  reason: 'ALL' | 'BY_ACTIVITY' | 'ASSIGNED' | 'NONE'
}

/** Nothing matches. Expressed as an impossible filter rather than an empty result. */
const NOTHING: ResourceQuery = { filter: { _id: { $in: [] } }, reason: 'NONE' }

/**
 * The published activities this person works.
 *
 * A person assigned no activity, whose role is scoped `ALL` on that axis, works everything the
 * tenant publishes — which is what a supervisor needs. A person with named assignments works
 * exactly those.
 */
async function activitiesWorked(access: EffectiveAccess): Promise<ActivityDefinitionDoc[]> {
  const where: Record<string, unknown> = {
    tenantId: access.tenantId,
    status: 'PUBLISHED',
    currentRevision: { $gt: 0 },
  }
  if (access.scope.activities !== 'ALL') {
    if (access.activityKeys.length === 0) return []
    where.key = { $in: access.activityKeys }
  }
  return ActivityDefinition.find(where).lean<ActivityDefinitionDoc[]>()
}

/**
 * Every area that belongs to the locations this person is posted to.
 *
 * One small query, and the only way to honour a location limit against a collection whose rows
 * know their area and not their location.
 */
async function areasOfSites(access: EffectiveAccess): Promise<string[]> {
  const areas = await Station.find(
    { tenantId: access.tenantId, siteId: { $in: access.siteIds } },
    { _id: 1 },
  ).lean()
  return areas.map((a) => String(a._id))
}

/**
 * Both limits where both apply, whichever one applies where only one does, and no limit at all
 * where neither does. `null` means "unrestricted", which is not the same as the empty array —
 * that means "restricted to nothing", and callers refuse on it.
 */
function intersect(a: string[] | null, b: string[] | null): string[] | null {
  if (!a) return b
  if (!b) return a
  const second = new Set(b)
  return a.filter((x) => second.has(x))
}

/** The live revision of a definition, which is what its relationships are read from. */
const live = (a: ActivityDefinitionDoc) => a.revisions.find((r) => r.revision === a.currentRevision) ?? null

/**
 * Builds the filter for the resources this person may see.
 *
 * Deliberately returns a filter rather than a list: a caller usually wants to combine it with
 * its own conditions and let the database do the work, and materialising every horse on the
 * estate in order to intersect it in memory is the wrong shape at any real size.
 */
export async function visibleResourceQuery(access: EffectiveAccess): Promise<ResourceQuery> {
  if (!access.permissions.has('resources.read')) return NOTHING
  if (access.scope.resources === 'NONE') return NOTHING

  const base: Record<string, unknown> = { tenantId: access.tenantId }

  /*
   * The location they work at, expressed as the areas that make it up.
   *
   * A resource stands in an area, and an area belongs to a location; a resource does not carry
   * its location itself. So a location limit has to be resolved into areas before it can be
   * asked of the database — filtering on a field the collection does not have would silently
   * match nothing, which looks exactly like a permission working and is not one.
   *
   * This is the boundary that matters, and the one the client asked about by name: a trainer
   * at Al-Jihfa does not touch a horse at Wadi al-Qahah, even though both animals are eligible
   * for exactly the same ride.
   */
  const atMyLocation =
    access.scope.sites !== 'ALL' && access.siteIds.length ? await areasOfSites(access) : null

  /*
   * A location with no areas in it holds nothing, so there is nothing to see.
   *
   * Settled once, here, so every branch below can treat `atMyLocation` as either "no limit"
   * or "a non-empty list" and does not have to ask again.
   */
  if (atMyLocation && atMyLocation.length === 0) return NOTHING

  if (access.scope.resources === 'ALL') {
    /*
     * Somebody who sees everything still only sees it where they are posted, and at this
     * breadth their own area is a meaningful narrowing rather than an obstruction.
     */
    const narrowed =
      access.scope.areas !== 'ALL' && access.areaIds.length
        ? intersect(atMyLocation, access.areaIds)
        : atMyLocation

    // Unlike above, this one can genuinely be empty: somebody posted to an area that is not
    // in the location they are scoped to reaches nothing, and should be told so.
    if (narrowed) {
      if (narrowed.length === 0) return NOTHING
      base.stationId = { $in: narrowed }
    }
    return { filter: base, reason: 'ALL' }
  }

  if (access.scope.resources === 'ASSIGNED') {
    /*
     * Only what stands at their own counter.
     *
     * The narrowest useful setting — an animal worker responsible for one paddock.
     */
    if (access.terminalIds.length === 0) return NOTHING
    if (atMyLocation) base.stationId = { $in: atMyLocation }
    return { filter: { ...base, kioskId: { $in: access.terminalIds } }, reason: 'ASSIGNED' }
  }

  /* BY_ACTIVITY — the interesting one. */
  const activities = await activitiesWorked(access)
  if (activities.length === 0) return NOTHING

  const kinds = new Set<string>()
  const named = new Set<string>()

  for (const activity of activities) {
    const revision = live(activity)
    if (!revision) continue
    for (const id of revision.assetTypeIds ?? []) kinds.add(id)
    for (const id of revision.eligibleResourceIds ?? []) named.add(id)
  }

  /*
   * Location bounds the resource. The activity does not.
   *
   * Two different questions that look like one. An activity's areas say where the *work*
   * happens — the riding tour runs on the equestrian track. A resource's area says where it
   * *lives* — the horses are in the stable. Requiring the two to match is how a trainer ends
   * up shown an empty list of horses while standing in a yard full of them.
   *
   * So what bounds which animals a person may work is their location, and which *kinds* is
   * their activity. That is exactly the client's own example: the trainer at South of 'Usfan
   * and the trainer at Al-Jihfa run the same ride on the same kind of animal and must never
   * see each other's.
   */
  if (atMyLocation) base.stationId = { $in: atMyLocation }

  /*
   * A named resource wins over its kind.
   *
   * An activity that names six horses means those six, not every horse of that kind — that is
   * the whole reason for naming them. So when any activity this person works names individual
   * resources, the union is "the named ones, plus every unit of any kind named without
   * individuals". Expressed as an `$or` so one query answers it.
   */
  const clauses: Record<string, unknown>[] = []
  if (named.size) clauses.push({ _id: { $in: [...named] } })

  const kindsWithoutNamed = [...kinds].filter((kind) =>
    activities.every((a) => {
      const r = live(a)
      if (!r || !(r.assetTypeIds ?? []).includes(kind)) return true
      return (r.eligibleResourceIds ?? []).length === 0
    }),
  )
  if (kindsWithoutNamed.length) clauses.push({ assetTypeId: { $in: kindsWithoutNamed } })

  if (clauses.length === 0) return NOTHING
  return { filter: { ...base, ...(clauses.length === 1 ? clauses[0] : { $or: clauses }) }, reason: 'BY_ACTIVITY' }
}

/**
 * Which *kinds* of resource this person may see.
 *
 * The same rule as `visibleResourceQuery`, answered one level up. A screen that lists kinds —
 * "Horses, Camels, Goats" — needs this rather than the units, and deriving it by listing every
 * unit and collecting its kind is both slower and wrong at the edges: an activity may name a
 * kind that has no units yet, and that kind should still appear to the people who work it.
 *
 * Returns a Mongo filter fragment on `AssetType`, `{}` meaning no restriction.
 */
export async function visibleResourceKindQuery(access: EffectiveAccess): Promise<ResourceQuery> {
  if (!access.permissions.has('resources.read')) return NOTHING
  if (access.scope.resources === 'NONE') return NOTHING
  if (access.scope.resources === 'ALL') return { filter: { tenantId: access.tenantId }, reason: 'ALL' }

  if (access.scope.resources === 'ASSIGNED') {
    /* Whatever kinds actually stand at their counter. */
    if (access.terminalIds.length === 0) return NOTHING
    const kinds = await AssetUnit.distinct('assetTypeId', {
      tenantId: access.tenantId,
      kioskId: { $in: access.terminalIds },
    })
    if (kinds.length === 0) return NOTHING
    return { filter: { tenantId: access.tenantId, _id: { $in: kinds } }, reason: 'ASSIGNED' }
  }

  /* BY_ACTIVITY — the kinds the activities they work are allowed to use. */
  const activities = await activitiesWorked(access)
  const kinds = new Set<string>()
  for (const activity of activities) {
    for (const id of live(activity)?.assetTypeIds ?? []) kinds.add(id)
  }
  if (kinds.size === 0) return NOTHING
  return { filter: { tenantId: access.tenantId, _id: { $in: [...kinds] } }, reason: 'BY_ACTIVITY' }
}

/** The resources themselves, for a caller that just wants the list. */
export async function visibleResources(access: EffectiveAccess) {
  const { filter } = await visibleResourceQuery(access)
  return AssetUnit.find(filter).sort({ identifier: 1 }).lean()
}

/**
 * Whether this person may put this particular resource to work.
 *
 * Asked at the moment of assignment rather than inferred from a list, because the list a
 * screen was rendered from can be minutes old and a horse can be stood down in between.
 */
export async function mayUseResource(access: EffectiveAccess, resourceId: string): Promise<boolean> {
  if (!access.permissions.has('resources.assign')) return false
  const { filter } = await visibleResourceQuery(access)
  const found = await AssetUnit.findOne({ ...filter, _id: resourceId }, { _id: 1 }).lean()
  return !!found
}

/**
 * The activities a counter may sell.
 *
 * An activity names the counters it is sold at; a counter that is named by none of them sells
 * whatever its tenant publishes. That default matters: a tenant with one counter should not
 * have to wire every activity to it before anything can be sold.
 */
export async function activitiesAtTerminal(tenantId: string, terminalId: string) {
  const published = await ActivityDefinition.find({
    tenantId,
    status: 'PUBLISHED',
    currentRevision: { $gt: 0 },
  }).lean<ActivityDefinitionDoc[]>()

  return published.filter((a) => {
    const revision = live(a)
    const named = revision?.terminalIds ?? []
    return named.length === 0 || named.includes(terminalId)
  })
}

/**
 * The activities a job may be assigned to work.
 *
 * An activity names the jobs that may operate it; one that names none may be operated by any
 * job the tenant chooses. This is what makes a newly published activity appear on the employee
 * form without a deployment.
 */
export async function activitiesForRole(tenantId: string, roleKey: string | null) {
  const published = await ActivityDefinition.find({
    tenantId,
    status: 'PUBLISHED',
    currentRevision: { $gt: 0 },
  })
    .sort({ name: 1 })
    .lean<ActivityDefinitionDoc[]>()

  if (!roleKey) return published

  return published.filter((a) => {
    const allowed = live(a)?.operatorRoleKeys ?? []
    return allowed.length === 0 || allowed.includes(roleKey)
  })
}
