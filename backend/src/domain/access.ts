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
