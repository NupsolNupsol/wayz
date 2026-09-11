import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { verifyToken } from '../utils/jwt.js'
import type { Role } from '../domain/types.js'
import { enterTenant, resolveTenant } from '../platform/tenantContext.js'

/**
 * Verifies the caller, then puts the request inside that caller's tenant.
 *
 * The two are deliberately one step. "Authenticated" and "in a tenant" become the same
 * condition, so there is no window in which a handler is trusted but pointed at no
 * database — and no route can forget to add the second half.
 *
 * The tenant comes from the signed token and from nowhere else; a header or query
 * parameter naming a different tenant has no effect.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing bearer token.')

  let payload
  try {
    payload = verifyToken(header.slice(7))
  } catch {
    throw ApiError.unauthorized('Invalid or expired token.')
  }
  req.auth = payload

  resolveTenant(payload.tenantId)
    .then((ctx) => enterTenant(ctx, next))
    .catch(next)
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized()
    if (!roles.includes(req.auth.role)) throw ApiError.forbidden(`Requires role: ${roles.join(', ')}.`)
    next()
  }
}

export const requireAgent = requireRole('AGENT')

export const requireLagoonDesk = requireRole('AGENT', 'CHIEF_CAPTAIN')

export const requireOverride = requireRole('SUPERVISOR', 'MANAGER', 'PROJECT_MANAGER', 'TENANT_ADMIN')

export const requireTenantAdmin = requireRole('TENANT_ADMIN')

export const requireHr = requireRole('HR', 'TENANT_ADMIN')
