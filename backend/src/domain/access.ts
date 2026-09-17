import { ACTIVITY_SCOPED, SCOPE_LEVEL } from './roles.js';
import type { EngineKind } from './types.js';
import type { Scope } from '../interfaces/index.js';

export function allowedEngines(scope: Pick<Scope, 'role' | 'engineKinds'>): EngineKind[] | null {
  if (!ACTIVITY_SCOPED.includes(scope.role)) return null;
  return scope.engineKinds ?? [];
}

/**
 * Whether this person works the built-in engine a booking was sold under.
 *
 * `null` — a booking sold under a tenant's own activity — is not answered here and is not
 * refused here either. Engines say nothing about it: what governs an activity booking is the
 * activity graph, which is asked for separately by whoever needs it. Returning `false` for a
 * booking with no engine would hide every activity sale from everybody, and returning it from
 * a function named after engines would be the wrong place to decide it anyway.
 */
export function canWorkEngine(
  scope: Pick<Scope, 'role' | 'engineKinds'>,
  engineKind: EngineKind | null
): boolean {
  if (engineKind === null) return true;
  const allowed = allowedEngines(scope);
  return allowed === null || allowed.includes(engineKind);
}

export function engineFilter(
  scope: Pick<Scope, 'role' | 'engineKinds'>,
  requested?: EngineKind
): EngineKind | { $in: EngineKind[] } | undefined {
  const allowed = allowedEngines(scope);
  if (allowed === null) return requested;
  if (requested) return allowed.includes(requested) ? requested : { $in: [] };
  return { $in: allowed };
}

export function scopeKiosk(scope: Pick<Scope, 'role' | 'kioskId'>): string | null {
  return SCOPE_LEVEL[scope.role] === 'kiosk' ? (scope.kioskId ?? '') : null;
}

export function kioskFilter(scope: Pick<Scope, 'role' | 'kioskId'>): string | undefined {
  return scopeKiosk(scope) ?? undefined;
}

/**
 * Every unit a member of staff can reach from where they stand, as one complete condition.
 *
 * It says *where* as well as *which*, so no caller adds its own "same station" beside it — that
 * pairing is exactly how area-held stock went missing, because an animal's area is not the
 * reception's.
 *
 * Three kinds of place:
 *
 *  - **A desk's own units** — the scooters in its bay, the boats at its jetty. Same station,
 *    same counter.
 *  - **The lockers at its station's gates.** A Shop & Drop counter is a point of sale; the
 *    compartments stand at the gates, so it allocates one at any gate of its own station.
 *  - **Stock held by the location itself** — no counter, no gate. An animal is the case that
 *    made this necessary: a horse lives in the stable area and is sold at the reception area of
 *    the same site, so it is reachable from **any station of that site**. Requiring the
 *    reception's own station made every seeded WIQAR ride unsellable at every reception.
 *
 * Someone not tied to a counter (a manager, a supervisor) sees everything at their station plus
 * the same location-held stock.
 */
export function reachableUnitsAt(
  scope: Pick<Scope, 'role' | 'kioskId'>,
  where: Places
): Record<string, unknown> {
  return unitsReachableFrom(kioskFilter(scope), where);
}

export interface Places {
  stationId: string;
  gateIds?: string[];
  siteStationIds?: string[];
}

/**
 * The same rule, keyed by the desk in play rather than by who is asking.
 *
 * `desk` undefined means nobody is standing at a particular counter, so the whole station is in
 * reach. The workflow uses this form: an action on a booking is bounded by the booking's own
 * desk whoever performs it, so a supervisor starting a scooter rental still gets that bay's
 * scooters and not the next bay's.
 */
export function unitsReachableFrom(
  desk: string | undefined,
  where: Places
): Record<string, unknown> {
  const { stationId, gateIds = [], siteStationIds = [stationId] } = where;
  const heldByTheLocation = { stationId: { $in: siteStationIds }, kioskId: null, gateId: null };

  if (desk === undefined) return { $or: [{ stationId }, heldByTheLocation] };

  const places: Record<string, unknown>[] = [{ stationId, kioskId: desk }];
  if (gateIds.length > 0) places.push({ stationId, gateId: { $in: gateIds } });
  places.push(heldByTheLocation);
  return { $or: places };
}
