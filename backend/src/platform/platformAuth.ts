import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { platformDb } from './connections.js'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

/**
 * Who runs the platform, as opposed to who runs a tenant.
 *
 * These are different populations with different powers and they must never be confusable.
 * A tenant administrator is the most powerful person *inside* one company's data and has no
 * business seeing another company exists. A platform administrator creates companies and
 * never touches their operational data at all.
 *
 * So a platform session is a different token with a different audience. A tenant token
 * presented here is refused, and this token presented to a tenant route is refused there —
 * not by checking a role inside one shared token, which is one careless `role` comparison
 * away from letting a tenant admin walk into the control plane, but because the two
 * credentials cannot be mistaken for one another.
 */
const PLATFORM_AUDIENCE = 'lockerflow:platform'

export interface PlatformJwtPayload {
  sub: string
  email: string
  aud: typeof PLATFORM_AUDIENCE
}

export interface PlatformActor {
  id: string
  email: string
  fullName: string
}

declare module 'express-serve-static-core' {
  interface Request {
    platformAdmin?: PlatformActor
  }
}

function signPlatformToken(admin: { _id: string; email: string }): string {
  return jwt.sign(
    { sub: admin._id, email: admin.email, aud: PLATFORM_AUDIENCE } satisfies PlatformJwtPayload,
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  )
}

export async function platformSignIn(email: string, password: string) {
  const { PlatformAdmin } = platformDb()
  const admin = await PlatformAdmin.findOne({ email: email.trim().toLowerCase() })

  /*
   * One answer for "no such account" and "wrong password".
   *
   * There is no public signup here and never will be, so the list of who administers this
   * platform is itself worth not confirming: a different message for an unknown address
   * turns this form into a way of discovering valid ones.
   */
  const ok = !!admin?.active && (await bcrypt.compare(password, admin.passwordHash))
  if (!ok || !admin) throw ApiError.unauthorized('Invalid email or password.')

  admin.lastLoginAt = new Date()
  await admin.save()

  await recordPlatformAudit({
    actorId: admin._id,
    actorEmail: admin.email,
    action: 'PLATFORM_SIGN_IN',
    detail: 'Signed in to the control plane',
  })

  return {
    token: signPlatformToken(admin),
    admin: { id: admin._id, email: admin.email, fullName: admin.fullName },
  }
}

/**
 * Guards every control-plane route, and deliberately does *not* enter a tenant.
 *
 * The tenant middleware puts a request inside one company's database as part of
 * authenticating it. This one must not: a platform administrator acts on the registry, and
 * a request that quietly landed in some tenant's data would be exactly the leak the
 * database-per-tenant design exists to prevent. Anything here that needs tenant data asks
 * for it explicitly, one tenant at a time, and says so.
 */
export function authenticatePlatform(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Missing bearer token.')

  let payload: PlatformJwtPayload
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as PlatformJwtPayload
  } catch {
    throw ApiError.unauthorized('Invalid or expired token.')
  }

  // A tenant token carries no platform audience, so it cannot reach the control plane even
  // though both are signed with the same key.
  if (payload.aud !== PLATFORM_AUDIENCE) {
    throw ApiError.forbidden('That sign-in is for a tenant workspace, not the control plane.')
  }

  const { PlatformAdmin } = platformDb()
  PlatformAdmin.findById(payload.sub)
    .lean()
    .then((admin: { _id: string; email: string; fullName: string; active: boolean } | null) => {
      if (!admin?.active) throw ApiError.unauthorized('That administrator is no longer active.')
      req.platformAdmin = { id: admin._id, email: admin.email, fullName: admin.fullName }
      next()
    })
    .catch(next)
}

export function platformActor(req: Request): PlatformActor {
  if (!req.platformAdmin) throw ApiError.unauthorized()
  return req.platformAdmin
}

/**
 * The control plane's own record of who did what.
 *
 * Separate from every tenant's audit trail, because these actions happen above tenants:
 * creating a company, suspending one, changing what it is allowed to do. A tenant must not
 * be able to read it, and it must survive a tenant being deleted.
 */
export async function recordPlatformAudit(entry: {
  actorId: string
  actorEmail: string
  action: string
  tenantId?: string | null
  detail?: string
}) {
  const { PlatformAudit } = platformDb()
  await PlatformAudit.create({
    _id: `paud-${nanoid(10)}`,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    tenantId: entry.tenantId ?? null,
    detail: entry.detail ?? '',
  })
}
