import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { EngineKind, Role } from '../domain/types.js'

/**
 * A session belonging to somebody who works at one of the organisations.
 *
 * `kind` is absent on these rather than set to `'EMPLOYEE'`, so that every token issued before
 * platform sessions existed still reads correctly — an undefined kind means an employee.
 */
export interface JwtPayload {
  kind?: 'EMPLOYEE'
  sub: string
  role: Role
  tenantId: string
  stationId: string
  kioskId: string | null
  /** The gate this member of staff is posted to, if their job involves one. */
  gateId?: string | null
  engineKinds: EngineKind[]
}

/**
 * A session belonging to whoever runs the platform.
 *
 * It carries no organisation, because a platform administrator does not belong to one. That
 * absence is the whole point: `authenticate` would have nothing to scope the request to, so it
 * refuses this token outright and `authenticatePlatform` is the only thing that accepts it.
 */
export interface PlatformJwtPayload {
  kind: 'PLATFORM'
  sub: string
  email: string
  name: string
}

export type AnyJwtPayload = JwtPayload | PlatformJwtPayload

export const isPlatformToken = (p: AnyJwtPayload): p is PlatformJwtPayload => p.kind === 'PLATFORM'

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function signPlatformToken(payload: PlatformJwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}

export function verifyAnyToken(token: string): AnyJwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as AnyJwtPayload
}
