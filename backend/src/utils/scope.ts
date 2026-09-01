import type { Request } from 'express'

import { ApiError } from './ApiError.js'
import type { Scope } from '../interfaces/index.js'

export function scopeFromReq(req: Request): Scope {
  if (!req.auth) throw ApiError.unauthorized()
  return {
    tenantId: req.auth.tenantId,
    stationId: req.auth.stationId,
    agentId: req.auth.sub,
    role: req.auth.role,
    kioskId: req.auth.kioskId ?? null,
    engineKinds: req.auth.engineKinds ?? [],
  }
}
