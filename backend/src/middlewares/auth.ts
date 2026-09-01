import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { verifyToken } from '../utils/jwt.js'
import type { Role } from '../domain/types.js'

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing bearer token.')
  try {
    req.auth = verifyToken(header.slice(7))
    next()
  } catch {
    throw ApiError.unauthorized('Invalid or expired token.')
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized()
    if (!roles.includes(req.auth.role)) throw ApiError.forbidden(`Requires role: ${roles.join(', ')}.`)
    next()
  }
}

export const requireAgent = requireRole('AGENT', 'CASHIER')


export const requireTenantAdmin = requireRole('TENANT_ADMIN')

export const requireHr = requireRole('HR', 'TENANT_ADMIN')
