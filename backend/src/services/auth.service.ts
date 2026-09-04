import mongoose from 'mongoose'
import { recordAudit } from './audit.service.js'
import { Kiosk, Station, Tenant, User, hashPassword, hashInviteToken } from '../models/index.js'
import type { UserDoc } from '../models/index.js'
import type { Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { signToken } from '../utils/jwt.js'
import { ROLE_LABELS } from '../constants/labels.constants.js'

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
  const [station, kiosk] = await Promise.all([
    Station.findById(user.stationId).lean(),
    user.kioskId ? Kiosk.findById(user.kioskId).lean() : null,
  ])
  return {
    id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    engineKinds: user.engineKinds ?? [],
    tenant: tenant
      ? {
          id: tenant._id,
          name: tenant.name,
          legalName: tenant.legalName,
          crNumber: tenant.crNumber,
          vatNumber: tenant.vatNumber,
          currency: tenant.currency,
          vatRate: tenant.vatRate,
          enabledEngines: tenant.enabledEngines,
          branding: tenant.branding,
        }
      : null,
    station: station ? { id: station._id, name: station.name, engineKinds: station.engineKinds, siteId: station.siteId, zoneId: station.zoneId } : null,
    kiosk: kiosk ? { id: kiosk._id, name: kiosk.name, code: kiosk.code, stationId: kiosk.stationId, siteId: kiosk.siteId } : null,
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
    engineKinds: user.engineKinds ?? [],
  })
  return { token: authToken, user: await buildMe(user._id) }
}
