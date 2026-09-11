import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { EngineKind, Role } from '../domain/types.js'

export interface JwtPayload {
  sub: string
  role: Role
  tenantId: string
  stationId: string
  kioskId: string | null
  /** The gate this member of staff is posted to, if their job involves one. */
  gateId?: string | null
  engineKinds: EngineKind[]
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}
