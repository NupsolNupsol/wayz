import { ACTIVITY_SCOPED, SCOPE_LEVEL } from './roles.js'
import type { EngineKind } from './types.js'
import type { Scope } from '../interfaces/index.js'

export function allowedEngines(scope: Pick<Scope, 'role' | 'engineKinds'>): EngineKind[] | null {
  if (!ACTIVITY_SCOPED.includes(scope.role)) return null
  return scope.engineKinds ?? []
}

export function canWorkEngine(scope: Pick<Scope, 'role' | 'engineKinds'>, engineKind: EngineKind): boolean {
  const allowed = allowedEngines(scope)
  return allowed === null || allowed.includes(engineKind)
}

export function engineFilter(
  scope: Pick<Scope, 'role' | 'engineKinds'>,
  requested?: EngineKind,
): EngineKind | { $in: EngineKind[] } | undefined {
  const allowed = allowedEngines(scope)
  if (allowed === null) return requested
  if (requested) return allowed.includes(requested) ? requested : { $in: [] }
  return { $in: allowed }
}

export function scopeKiosk(scope: Pick<Scope, 'role' | 'kioskId'>): string | null {
  return SCOPE_LEVEL[scope.role] === 'kiosk' ? (scope.kioskId ?? '') : null
}

export function kioskFilter(scope: Pick<Scope, 'role' | 'kioskId'>): string | undefined {
  return scopeKiosk(scope) ?? undefined
}

/**
 * Where a desk-scoped member of staff can reach stock.
 *
 * Two places, and they are not the same place. A desk holds what it hands over itself — the
 * scooters in its bay, the boats at its jetty — and that is its own kiosk. Compartments are not
 * held by a desk at all: a Shop & Drop counter is a point of sale, and the lockers stand at the
 * gates of the venue, so the counter has to be able to allocate one at any gate in its station.
 *
 * Passing no gates gives the old rule back exactly — the desk's own kiosk and nothing else —
 * which is what every activity that does not use gates still wants.
 */
export function reachableUnitFilter(
  scope: Pick<Scope, 'role' | 'kioskId'>,
  gateIds: string[] = [],
): Record<string, unknown> | undefined {
  const kiosk = kioskFilter(scope)
  if (kiosk === undefined) return undefined
  if (gateIds.length === 0) return { kioskId: kiosk }
  return { $or: [{ kioskId: kiosk }, { gateId: { $in: gateIds } }] }
}
