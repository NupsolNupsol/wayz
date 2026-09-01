import type { EngineKind } from './types.js'
import type { Scope } from '../interfaces/index.js'

/**
 * An agent is dedicated to specific activities. Every other role sees the whole tenant,
 * which is expressed as an empty list rather than a special case at each call site.
 */
export function allowedEngines(scope: Pick<Scope, 'role' | 'engineKinds'>): EngineKind[] | null {
  if (scope.role !== 'AGENT') return null
  const engines = scope.engineKinds ?? []
  return engines.length ? engines : []
}

export function canWorkEngine(scope: Pick<Scope, 'role' | 'engineKinds'>, engineKind: EngineKind): boolean {
  const allowed = allowedEngines(scope)
  return allowed === null || allowed.includes(engineKind)
}

/** Narrows a Mongo query to the activities the caller may see. */
export function engineFilter(
  scope: Pick<Scope, 'role' | 'engineKinds'>,
  requested?: EngineKind,
): EngineKind | { $in: EngineKind[] } | undefined {
  const allowed = allowedEngines(scope)
  if (allowed === null) return requested
  if (requested) return allowed.includes(requested) ? requested : { $in: [] }
  return { $in: allowed }
}
