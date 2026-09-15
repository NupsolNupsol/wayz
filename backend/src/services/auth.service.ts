import mongoose from 'mongoose'
import { recordAudit } from './audit.service.js'
import { Gate, Kiosk, Station, Tenant, User, hashPassword, hashInviteToken } from '../models/index.js'
import { currentTenant } from '../platform/tenantContext.js'
import type { UserDoc } from '../models/index.js'
import type { Role } from '../domain/types.js'
import { resolveDiscountReasons } from '../domain/rules.js'
import { ApiError } from '../utils/ApiError.js'
import { signToken } from '../utils/jwt.js'
import { ROLE_LABELS } from '../constants/labels.constants.js'
import { PHONE_PROOF_TTL_MIN } from './customer.service.js'

export const MIN_PASSWORD_LENGTH = 8

export async function signOut(tenantId: string, userId: string) {
  await recordAudit({
    tenantId,
    actorId: userId,
    action: 'SIGNED_OUT',
    entity: 'Session',
    entityId: userId,
    detail: 'Signed out',
  })
  return { ok: true }
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.trim().toLowerCase() })
  if (!user) throw ApiError.unauthorized('Invalid email or password.')
  if (!user.passwordHash) {
    throw ApiError.unauthorized('This account has not been set up yet — use the invitation link that was emailed to you.')
  }
  if (user.active === false) throw ApiError.forbidden('This account has been suspended.')
  const ok = await user.comparePassword(password)
  if (!ok) throw ApiError.unauthorized('Invalid email or password.')

  const token = signToken({
    sub: user._id,
    role: user.role,
    tenantId: user.tenantId,
    stationId: user.stationId,
    kioskId: user.kioskId ?? null,
    gateId: user.gateId ?? null,
    engineKinds: user.engineKinds ?? [],
  })

  user.lastLoginAt = new Date()
  await user.save()

  await recordAudit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'SIGNED_IN',
    entity: 'Session',
    entityId: user._id,
    detail: `${user.role} · ${user.email}`,
  })

  return { token, user: await buildMe(user._id) }
}

export async function authenticateOverride(
  tenantId: string,
  email: string,
  password: string,
  allowedRoles: Role[],
): Promise<UserDoc> {
  const user = await User.findOne({ email: email.trim().toLowerCase() })
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Those credentials are not valid.')
  }
  if (user.tenantId !== tenantId) throw ApiError.forbidden('That account belongs to another tenant.')
  if (!allowedRoles.includes(user.role)) {
    throw ApiError.forbidden(`An override requires one of: ${allowedRoles.join(', ')}.`)
  }
  return user
}

export async function buildMe(userId: string) {
  const user = await User.findById(userId).lean()
  if (!user) throw ApiError.notFound('User not found.')
  const tenant = await Tenant.findById(user.tenantId).lean()
  const [station, kiosk, gate] = await Promise.all([
    Station.findById(user.stationId).lean(),
    user.kioskId ? Kiosk.findById(user.kioskId).lean() : null,
    user.gateId ? Gate.findById(user.gateId).lean() : null,
  ])
  return {
    id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    engineKinds: user.engineKinds ?? [],
    /*
     * The tenant's own activities this person works.
     *
     * Their counter reads this to know what to offer. Kept apart from `engineKinds`, which
     * names the activities the product ships with — see the user model for why.
     */
    activityKeys: user.activityKeys ?? [],
    /*
     * The job their company defined.
     *
     * Their screens read this to know what they may do. `role` beside it is the platform
     * primitive and carries no business meaning — see `roleDefinition.model.ts`.
     */
    roleKey: user.roleKey ?? null,
    tenant: tenant
      ? {
          id: tenant._id,
          /*
           * The handle this tenant is reached at, from the control-plane registry.
           *
           * The web app needs it to answer "whose page is this?" without guessing — that is
           * what keeps a session on one tenant from being carried onto another tenant's
           * address. It comes from the registry rather than from anything the client sent,
           * for the same reason every other tenant identifier does.
           */
          slug: currentTenant()?.registry?.slug ?? tenant._id,
          name: tenant.name,
          legalName: tenant.legalName,
          crNumber: tenant.crNumber,
          vatNumber: tenant.vatNumber,
          currency: tenant.currency,
          vatRate: tenant.vatRate,
          enabledEngines: tenant.enabledEngines,
          /*
           * Branding comes from the registry, which is the copy a super admin edits.
           *
           * The tenant's own document carries one too, from before there was a control plane.
           * Two sources of truth for the same colours is one too many, and the wrong one wins
           * silently: an administrator changes a brand in the control plane, nothing happens
           * inside the tenant, and there is nothing on screen to explain why. The registry is
           * authoritative; the local copy fills in anything not set there.
           */
          branding: { ...tenant.branding, ...(currentTenant()?.registry?.branding ?? {}) },
          capabilities: currentTenant()?.registry?.capabilities ?? [],
          discountReasons: resolveDiscountReasons(tenant.discountReasons),
          autoPrintReceipt: tenant.settings?.autoPrintReceipt !== false,
          phoneProofTtlMin: PHONE_PROOF_TTL_MIN,
        }
      : null,
    station: station ? { id: station._id, name: station.name, engineKinds: station.engineKinds, siteId: station.siteId, zoneId: station.zoneId } : null,
    kiosk: kiosk ? { id: kiosk._id, name: kiosk.name, code: kiosk.code, stationId: kiosk.stationId, siteId: kiosk.siteId } : null,
    // The locker hall they answer for. A mobility agent works a bay and covers a gate; the gate is
    // where the bags are, and what the retrieval screens are built around.
    gate: gate ? { id: gate._id, name: gate.name, code: gate.code, stationId: gate.stationId, location: gate.location } : null,
  }
}

type LiveUser = mongoose.HydratedDocument<UserDoc>

async function invitedUser(token: string): Promise<LiveUser> {
  const value = (token ?? '').trim()
  if (!value) throw ApiError.notFound('That invitation link is not valid.')

  const user = await User.findOne({ 'invite.tokenHash': hashInviteToken(value) })
  if (!user || !user.invite) throw ApiError.notFound('That invitation link is not valid.')
  if (user.passwordHash) throw ApiError.unprocessable('That invitation has already been used.')
  if (new Date(user.invite.expiresAt).getTime() < Date.now()) {
    throw ApiError.unprocessable('That invitation has expired — ask for a new one.')
  }
  return user
}

export async function readInvitation(token: string) {
  const user = await invitedUser(token)
  const tenant = await Tenant.findById(user.tenantId).lean()
  return {
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
    tenantName: tenant?.name ?? '',
    branding: tenant?.branding ?? null,
    expiresAt: user.invite!.expiresAt,
  }
}

export async function acceptInvitation(token: string, password: string, confirmPassword: string) {
  const user = await invitedUser(token)

  const value = password ?? ''
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.badRequest(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (value !== confirmPassword) throw ApiError.badRequest('The two passwords do not match.')
  if (value.toLowerCase() === user.email.toLowerCase()) {
    throw ApiError.badRequest('Your password cannot be your email address.')
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    throw ApiError.badRequest('Use at least one letter and one number.')
  }

  user.passwordHash = hashPassword(value)
  user.invite = null
  await user.save()

  await recordAudit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'INVITATION_ACCEPTED',
    entity: 'User',
    entityId: user._id,
    detail: ROLE_LABELS[user.role] ?? user.role,
  })

  const authToken = signToken({
    sub: user._id,
    role: user.role,
    tenantId: user.tenantId,
    stationId: user.stationId,
    kioskId: user.kioskId ?? null,
    gateId: user.gateId ?? null,
    engineKinds: user.engineKinds ?? [],
  })
  return { token: authToken, user: await buildMe(user._id) }
}
