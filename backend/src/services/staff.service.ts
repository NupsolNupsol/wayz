import {
  Booking,
  Kiosk,
  Shift,
  Station,
  Tenant,
  User,
  hashPassword,
  newInviteToken,
  INVITE_TTL_HOURS,
  type UserDoc,
} from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { ENGINE_KINDS, ROLES, type EngineKind, type Role } from '../domain/types.js'
import { ROLE_LABELS } from '../constants/labels.constants.js'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { nextId } from './counter.service.js'
import { invitationEmail, isEmailConfigured, sendEmail } from './email.service.js'

import type { InviteResult, StaffInput } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

const OPERATIONAL_ROLES: Role[] = ['AGENT', 'CASHIER', 'DELIVERY_AGENT']

export const ASSIGNABLE_BY: Record<string, Role[]> = {
  MANAGER: OPERATIONAL_ROLES,
  TENANT_ADMIN: [...OPERATIONAL_ROLES, 'MANAGER', 'ACCOUNTANT', 'HR'],
}

export const ASSIGNABLE_ROLES: Role[] = ASSIGNABLE_BY.TENANT_ADMIN

async function sendInvitation(user: UserDoc, invitedBy: string): Promise<InviteResult> {
  const { token, tokenHash, expiresAt } = newInviteToken()
  const [tenant, inviter] = await Promise.all([
    Tenant.findById(user.tenantId).lean(),
    invitedBy ? User.findById(invitedBy).lean() : null,
  ])

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        invite: {
          tokenHash,
          expiresAt,
          sentAt: new Date(),
          invitedBy,
          deliveredTo: user.email,
        },
      },
    },
  )

  const link = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/invitation/${token}`

  if (!isEmailConfigured()) {
    logger.warn('Invitation not emailed — no mail provider configured', { user: user._id })
    return {
      emailed: false,
      deliveredTo: user.email,
      expiresAt,
      reason: 'No email provider is configured. Copy the link and give it to them yourself.',
      link,
    }
  }

  const result = await sendEmail({
    to: user.email,
    ...invitationEmail({
      fullName: user.fullName,
      roleLabel: ROLE_LABELS[user.role] ?? user.role,
      tenantName: tenant?.name ?? 'the platform',
      link,
      expiresInHours: INVITE_TTL_HOURS,
      invitedByName: inviter?.fullName,
    }),
  })

  return result.ok
    ? { emailed: true, deliveredTo: user.email, expiresAt, ...(env.INVITE_TEST_PEEK ? { link } : {}) }
    : { emailed: false, deliveredTo: user.email, expiresAt, reason: result.error, link }
}

/** Only an agent is narrowed to activities; every other role works the whole tenant. */
const ACTIVITY_SCOPED: Role[] = ['AGENT']

/** Bags live in compartments, so an agent on Shop & Drop answers for one kiosk. */
const NEEDS_KIOSK: EngineKind = 'SHOP_AND_DROP'

function resolveEngines(role: Role, engineKinds?: EngineKind[] | null): EngineKind[] {
  if (!ACTIVITY_SCOPED.includes(role)) return []

  const engines = [...new Set(engineKinds ?? [])]
  if (!engines.length) {
    throw ApiError.badRequest('Choose the activity this agent works — they only see the one they are assigned to.')
  }
  for (const engine of engines) {
    if (!ENGINE_KINDS.includes(engine)) throw ApiError.badRequest(`Unknown activity "${engine}".`)
  }
  return engines
}

async function resolveKiosk(
  tenantId: string,
  role: Role,
  engines: EngineKind[],
  stationId: string,
  kioskId?: string | null,
) {
  if (!ACTIVITY_SCOPED.includes(role)) return null

  const mustHaveKiosk = engines.includes(NEEDS_KIOSK)
  if (!kioskId) {
    if (mustHaveKiosk) throw ApiError.badRequest('A Shop & Drop agent answers for one kiosk — choose which.')
    return null
  }

  const kiosk = await Kiosk.findOne({ _id: kioskId, tenantId }).lean()
  if (!kiosk) throw ApiError.badRequest('That kiosk does not exist in this tenant.')
  if (kiosk.stationId !== stationId) {
    throw ApiError.badRequest('That kiosk belongs to a different station.')
  }
  return kiosk._id
}

function assertAssignableRole(actorRole: Role, role: Role) {
  if (!ROLES.includes(role)) throw ApiError.badRequest(`Unknown role "${role}".`)
  const allowed = ASSIGNABLE_BY[actorRole] ?? []
  if (!allowed.includes(role)) {
    throw ApiError.forbidden(`A ${actorRole.replaceAll('_', ' ').toLowerCase()} may not assign the ${role} role.`)
  }
}

export async function listStaff(scope: ManagerScope) {
  const [users, stations, shiftAgg, bookingAgg] = await Promise.all([
    User.find({ tenantId: scope.tenantId }).sort({ fullName: 1 }).lean(),
    Station.find({ tenantId: scope.tenantId }).lean(),
    Shift.aggregate([
      { $match: { tenantId: scope.tenantId, status: { $ne: 'CLOSED' } } },
      { $group: { _id: '$agentId', openShifts: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $group: { _id: '$agentId', bookings: { $sum: 1 } } },
    ]),
  ])

  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  const kiosks = await Kiosk.find({ tenantId: scope.tenantId }).lean()
  const kioskName = new Map(kiosks.map((k) => [k._id, k.name]))
  const openShifts = new Map(shiftAgg.map((s: { _id: string; openShifts: number }) => [s._id, s.openShifts]))
  const bookings = new Map(bookingAgg.map((b: { _id: string; bookings: number }) => [b._id, b.bookings]))

  const now = Date.now()
  return users.map((u) => ({
    _id: u._id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    setUp: !!u.passwordHash,
    invitePending: !u.passwordHash && !!u.invite && new Date(u.invite.expiresAt).getTime() > now,
    inviteExpiresAt: u.passwordHash ? null : (u.invite?.expiresAt ?? null),
    phone: u.phone,
    active: u.active !== false,
    stationId: u.stationId,
    stationName: stationName.get(u.stationId) ?? u.stationId,
    kioskId: u.kioskId ?? null,
    kioskName: u.kioskId ? (kioskName.get(u.kioskId) ?? u.kioskId) : null,
    engineKinds: u.engineKinds ?? [],
    lastLoginAt: u.lastLoginAt ?? null,
    hasOpenShift: (openShifts.get(u._id) ?? 0) > 0,
    bookingsHandled: bookings.get(u._id) ?? 0,
  }))
}

export async function createStaff(scope: ManagerScope, input: StaffInput) {
  assertAssignableRole(scope.role, input.role)

  const email = input.email.trim().toLowerCase()
  if (await User.exists({ email })) throw ApiError.badRequest('That email address is already registered.')

  const station = await Station.findOne({ _id: input.stationId, tenantId: scope.tenantId }).lean()
  if (!station) throw ApiError.badRequest('That station does not exist in this tenant.')

  const engines = resolveEngines(input.role, input.engineKinds)

  const user = await User.create({
    _id: await nextId('user'),
    email,
    passwordHash: null,
    invite: null,
    fullName: input.fullName.trim(),
    role: input.role,
    tenantId: scope.tenantId,
    siteId: station.siteId,
    zoneId: station.zoneId || null,
    stationId: input.stationId,
    kioskId: await resolveKiosk(scope.tenantId, input.role, engines, input.stationId, input.kioskId),
    engineKinds: engines,
    phone: input.phone ?? '',
    active: true,
  })

  const invitation = await sendInvitation(user, scope.userId)

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'STAFF_INVITED',
    entity: 'User',
    entityId: user._id,
    detail: `${ROLE_LABELS[input.role] ?? input.role} · ${invitation.emailed ? 'invitation emailed' : 'invitation not emailed'}`,
  })

  return { ...sanitiseUser(user.toObject()), invitation }
}

export async function reinviteStaff(scope: ManagerScope, id: string) {
  const user = await User.findOne({ _id: id, tenantId: scope.tenantId })
  if (!user) throw ApiError.notFound('Staff member not found.')
  if (!(ASSIGNABLE_BY[scope.role] ?? []).includes(user.role)) {
    throw ApiError.forbidden(`A ${scope.role.replaceAll('_', ' ').toLowerCase()} may not invite a ${user.role} account.`)
  }
  if (user.passwordHash) {
    throw ApiError.unprocessable('That account is already set up — send a password reset instead.')
  }

  const invitation = await sendInvitation(user, scope.userId)

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'STAFF_REINVITED',
    entity: 'User',
    entityId: user._id,
    detail: invitation.emailed ? 'invitation re-sent' : 'invitation not emailed',
  })

  return { ...sanitiseUser(user.toObject()), invitation }
}

export async function updateStaff(
  scope: ManagerScope,
  id: string,
  patch: Partial<Omit<StaffInput, 'password'>> & { active?: boolean },
) {
  const user = await User.findOne({ _id: id, tenantId: scope.tenantId })
  if (!user) throw ApiError.notFound('Staff member not found.')
  if (patch.role) assertAssignableRole(scope.role, patch.role)
  if (!(ASSIGNABLE_BY[scope.role] ?? []).includes(user.role)) {
    throw ApiError.forbidden(`A ${scope.role.replaceAll('_', ' ').toLowerCase()} may not change a ${user.role} account.`)
  }

  if (id === scope.userId && (patch.active === false || (patch.role && patch.role !== user.role))) {
    throw ApiError.unprocessable('You cannot change your own role or suspend your own account.')
  }

  if (patch.active === false) {
    const open = await Shift.countDocuments({ tenantId: scope.tenantId, agentId: id, status: { $ne: 'CLOSED' } })
    if (open > 0) throw ApiError.unprocessable('This agent has an open shift — reconcile and close it first.')
  }

  if (patch.stationId && patch.stationId !== user.stationId) {
    const station = await Station.findOne({ _id: patch.stationId, tenantId: scope.tenantId }).lean()
    if (!station) throw ApiError.badRequest('That station does not exist in this tenant.')
    user.siteId = station.siteId
  }

  if (patch.email) {
    const email = patch.email.trim().toLowerCase()
    if (email !== user.email && (await User.exists({ email }))) {
      throw ApiError.badRequest('That email address is already registered.')
    }
    user.email = email
  }
  if (patch.fullName) user.fullName = patch.fullName.trim()
  if (patch.role) user.role = patch.role
  if (patch.stationId) user.stationId = patch.stationId
  if (patch.phone !== undefined) user.phone = patch.phone
  if (patch.active !== undefined) user.active = patch.active

  user.engineKinds = resolveEngines(
    user.role,
    patch.engineKinds !== undefined ? patch.engineKinds : user.engineKinds,
  )
  user.kioskId = await resolveKiosk(
    scope.tenantId,
    user.role,
    user.engineKinds,
    user.stationId,
    patch.kioskId !== undefined ? patch.kioskId : user.kioskId,
  )

  await user.save()
  return sanitiseUser(user.toObject())
}

export async function resetStaffPassword(scope: ManagerScope, id: string, password: string) {
  if (!password || password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters.')
  const user = await User.findOne({ _id: id, tenantId: scope.tenantId })
  if (!user) throw ApiError.notFound('Staff member not found.')
  user.passwordHash = hashPassword(password)
  await user.save()
  return { ok: true }
}

function sanitiseUser(u: object) {
  const { passwordHash, __v, ...rest } = u as Record<string, unknown>
  void passwordHash
  void __v
  return rest
}
