import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { verifyAnyToken, isPlatformToken, type PlatformJwtPayload } from '../utils/jwt.js'
import type { Role } from '../domain/types.js'
import { enterOrg } from '../platform/orgScope.js'

/**
 * Verifies the caller, then puts the request inside that caller's organisation.
 *
 * The two are deliberately one step. "Authenticated" and "scoped to an organisation" become
 * the same condition, so there is no window in which a handler is trusted but unscoped — and
 * no route can forget to add the second half.
 *
 * The organisation comes from the signed token and from nowhere else; a header or query
 * parameter naming a different one has no effect.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing bearer token.')

  let payload
  try {
    payload = verifyAnyToken(header.slice(7))
  } catch {
    throw ApiError.unauthorized('Invalid or expired token.')
  }

  /*
   * A platform session is refused here rather than allowed through unscoped.
   *
   * Everything past this point reads and writes inside one organisation, and a platform
   * administrator has none. Letting the token through would leave the request authenticated
   * and unscoped — the exact state this middleware exists to make impossible — and every
   * query it made would then silently span every company on the platform.
   */
  if (isPlatformToken(payload)) {
    throw ApiError.forbidden('This is a platform session. Use the platform console.')
  }

  req.auth = payload

  // One database, so there is nothing to resolve: the organisation on the signed token is
  // entered directly, and every query this request makes is scoped to it from here.
  enterOrg(payload.tenantId, next)
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


/**
 * Verifies whoever runs the platform, and deliberately enters no organisation.
 *
 * The mirror of `authenticate`: that one refuses a platform token, this one refuses an
 * employee's. A request that gets past here is unscoped, which is correct for the handful of
 * endpoints that exist to look *across* organisations — and is why those endpoints all live
 * under one router, behind this one middleware, rather than being scattered.
 *
 * Unscoped does not mean unfiltered. Every platform handler still reads one organisation at a
 * time through `withinOrganisation`, so a report is assembled from scoped reads rather than
 * from one query that spans the database.
 */
export function authenticatePlatform(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing bearer token.')

  let payload
  try {
    payload = verifyAnyToken(header.slice(7))
  } catch {
    throw ApiError.unauthorized('Invalid or expired token.')
  }

  if (!isPlatformToken(payload)) {
    throw ApiError.forbidden('This console is for platform administrators.')
  }

  req.platform = payload
  next()
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set only by `authenticatePlatform`; absent on every organisation-scoped request. */
      platform?: PlatformJwtPayload
    }
  }
}
