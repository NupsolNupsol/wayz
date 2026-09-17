import { Booking, Gate, INVITE_TTL_HOURS, Kiosk, Shift, Station, Tenant, User, hashPassword, newInviteToken, type UserDoc } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { ROLES } from '../domain/types.js'
import type { EngineKind, Role } from '../domain/types.js'
import {
  ACTIVITY_SCOPED,
  ASSIGNABLE_BY,
  KIOSK_SCOPED,
  LAGOON_ONLY,
  SUB_MANAGER_ROLES,
} from '../domain/roles.js'
import { ROLE_LABELS } from '../constants/labels.constants.js'
import { ROLE_LABELS_AR } from '../constants/messages.constants.js'
import { ApiError } from '../utils/ApiError.js'
import { assertAdopted, isRegisteredActivity } from '../platform/activityCatalogue.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { nextId } from './counter.service.js'
import { invitationEmail, isEmailConfigured, sendEmail } from './email.service.js'

import type { InviteResult, StaffInput } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

export { ASSIGNABLE_BY } from '../domain/roles.js'

export const ASSIGNABLE_ROLES: Role[] = ASSIGNABLE_BY.TENANT_ADMIN ?? []

async function sendInvitation(user: UserDoc, invitedBy: string): Promise<InviteResult> {
  const { token, tokenHash, expiresAt } = newInviteToken()
  /*
   * The invitation link is opened by somebody who has no account yet, so it carries no way to
   * say which organisation it belongs to. It does not need to: the middleware that serves it
   * finds the user holding that token hash and enters their organisation — see publicAccess.
   */
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
      roleLabel: ROLE_LABELS_AR[user.role] ?? ROLE_LABELS[user.role] ?? user.role,
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

const LAGOON: EngineKind = 'LAGOON'

/**
 * Which built-in activities this person works.
 *
 * `activityKeys` is passed in because of what it means for this check rather than for what it
 * returns: somebody hired onto an activity their own company defined has no built-in engine
 * kind at all, and demanding one was the last place a WAYZ-shaped assumption still refused a
 * perfectly valid member of staff. Assigned to something — either kind of something — is the
 * real requirement.
 */
function resolveEngines(role: Role, engineKinds?: EngineKind[] | null, activityKeys?: string[] | null): EngineKind[] {
  if (!ACTIVITY_SCOPED.includes(role)) return []

  const engines = [...new Set(engineKinds ?? [])]
  if (!engines.length) {
    if ((activityKeys ?? []).length > 0) return []
    throw ApiError.badRequest('Choose the activity this person works — they only see the ones they are assigned to.')
  }
  for (const engine of engines) {
    if (!isRegisteredActivity(engine)) throw ApiError.badRequest(`Unknown activity "${engine}".`)
  }

  if (LAGOON_ONLY.includes(role) && engines.some((e) => e !== LAGOON)) {
    throw ApiError.badRequest(`${ROLE_LABELS[role] ?? role} only works the lagoon.`)
  }
  if (KIOSK_SCOPED.includes(role) && engines.length > 1) {
    throw ApiError.badRequest('Someone who answers for one desk works one activity — choose a single one.')
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
  if (!KIOSK_SCOPED.includes(role)) return null

  if (!kioskId) {
    throw ApiError.badRequest(`A ${(ROLE_LABELS[role] ?? role).toLowerCase()} answers for one kiosk — choose which.`)
  }

  const kiosk = await Kiosk.findOne({ _id: kioskId, tenantId }).lean()
  if (!kiosk) throw ApiError.badRequest('That kiosk does not exist in this tenant.')
  if (kiosk.stationId !== stationId) {
    throw ApiError.badRequest('That kiosk belongs to a different station.')
  }
  /*
   * A desk that runs only activities its own tenant defined has no built-in engine to match
   * against, and there is nothing to check here: which of those activities somebody works is
   * recorded on the person, not inferred from the counter they stand at.
   */
  if (kiosk.engineKind && !engines.includes(kiosk.engineKind)) {
    throw ApiError.badRequest(
      `${kiosk.name} runs ${kiosk.engineKind.replaceAll('_', ' ').toLowerCase()}, not the activity you chose.`,
    )
  }
  return kiosk._id
}

/**
 * The gate a member of staff covers, if their job involves one.
 *
 * A Mobility agent stands at a gate, so they are the one who fetches a customer's bags out of it
 * and hands them back — the Shop & Drop counter that sold the storage is elsewhere and holds no
 * lockers. That makes the gate a required part of hiring a Mobility agent, not an afterthought:
 * one hired without it can serve scooters and can do nothing about the lockers beside them.
 *
 * It is emphatically not the same thing as their kiosk. The kiosk is the vehicle bay they work
 * from; the gate is the locker hall they answer for. Both, and separately.
 */
async function resolveGate(
  tenantId: string,
  role: Role,
  engines: EngineKind[],
  stationId: string,
  gateId?: string | null,
): Promise<string | null> {
  const needsGate = role === 'AGENT' && engines.includes('MOBILITY')
  if (!needsGate) return null

  if (!gateId) {
    throw ApiError.badRequest('A mobility agent answers for one gate — choose which.', [
      'The gate is where the lockers are, and where they retrieve a customer’s bags.',
    ])
  }

  const gate = await Gate.findOne({ _id: gateId, tenantId, active: { $ne: false } }).lean()
  if (!gate) throw ApiError.badRequest('That gate does not exist in this tenant.')
  if (gate.stationId !== stationId) throw ApiError.badRequest('That gate belongs to a different station.')
  return gate._id
}

async function resolveReportsTo(tenantId: string, role: Role, reportsTo?: string | null): Promise<string | null> {
  if (!SUB_MANAGER_ROLES.includes(role) || !reportsTo) return null

  const lead = await User.findOne({ _id: reportsTo, tenantId }).lean()
  if (!lead) throw ApiError.badRequest('That manager does not exist in this tenant.')
  if (!(ASSIGNABLE_BY[lead.role] ?? []).includes(role)) {
    throw ApiError.badRequest(`A ${(ROLE_LABELS[lead.role] ?? lead.role).toLowerCase()} does not lead a ${(ROLE_LABELS[role] ?? role).toLowerCase()}.`)
  }
  return lead._id
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
    User.find({ tenantId: scope.tenantId, removedAt: null }).sort({ fullName: 1 }).lean(),
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
  const [kiosks, gates] = await Promise.all([
    Kiosk.find({ tenantId: scope.tenantId }).lean(),
    Gate.find({ tenantId: scope.tenantId }).lean(),
  ])
  const kioskName = new Map(kiosks.map((k) => [k._id, k.name]))
  const gateName = new Map(gates.map((g) => [g._id, g.name]))
  const leadName = new Map(users.map((u) => [u._id, u.fullName]))
  const openShifts = new Map(shiftAgg.map((s: { _id: string; openShifts: number }) => [s._id, s.openShifts]))
  const openShiftRows = await Shift.find(
    { tenantId: scope.tenantId, status: { $ne: 'CLOSED' } },
    { agentId: 1, status: 1 },
  ).lean()
  const shiftStatus = new Map(openShiftRows.map((row) => [row.agentId, row.status]))
  const bookings = new Map(bookingAgg.map((b: { _id: string; bookings: number }) => [b._id, b.bookings]))

  const now = Date.now()
  return users.map((u) => ({
    _id: u._id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    /*
     * What this company calls the job, when it differs from the platform's word.
     *
     * WIQAR's CEO and IT Manager both hold TENANT_ADMIN because both need full configuration
     * access — that is authorisation. Their titles are not the same, and a list showing both
     * as "CEO / tenant admin" reads as though the platform has two tenant administrator roles.
     * Empty for everybody whose job the platform's own label already describes.
     */
    roleLabel: u.roleLabel?.trim() || '',
    setUp: !!u.passwordHash,
    invitePending: !u.passwordHash && !!u.invite && new Date(u.invite.expiresAt).getTime() > now,
    inviteExpiresAt: u.passwordHash ? null : (u.invite?.expiresAt ?? null),
    phone: u.phone,
    active: u.active !== false,
    stationId: u.stationId,
    stationName: stationName.get(u.stationId) ?? u.stationId,
    kioskId: u.kioskId ?? null,
    kioskName: u.kioskId ? (kioskName.get(u.kioskId) ?? u.kioskId) : null,
    gateId: u.gateId ?? null,
    gateName: u.gateId ? (gateName.get(u.gateId) ?? u.gateId) : null,
    engineKinds: u.engineKinds ?? [],
    // Activities this tenant invented for itself, by key. See activity.model.ts.
    activityKeys: u.activityKeys ?? [],
    /** The job they hold, as their own company defines it. See roleDefinition.model.ts. */
    roleKey: u.roleKey ?? null,
    reportsTo: u.reportsTo ?? null,
    reportsToName: u.reportsTo ? (leadName.get(u.reportsTo) ?? u.reportsTo) : null,
    lastLoginAt: u.lastLoginAt ?? null,
    hasOpenShift: (openShifts.get(u._id) ?? 0) > 0,
    shiftStatus: shiftStatus.get(u._id) ?? null,
    bookingsHandled: bookings.get(u._id) ?? 0,
  }))
}

export async function createStaff(scope: ManagerScope, input: StaffInput) {
  assertAssignableRole(scope.role, input.role)

  const email = input.email.trim().toLowerCase()
  if (await User.exists({ email })) throw ApiError.badRequest('That email address is already registered.')

  const station = await Station.findOne({ _id: input.stationId, tenantId: scope.tenantId }).lean()
  if (!station) throw ApiError.badRequest('That station does not exist in this tenant.')

  const engines = resolveEngines(input.role, input.engineKinds, input.activityKeys)
  /*
   * Nobody is assigned an activity their organisation does not run.
   *
   * The catalogue says what exists, the organisation's adopted list says what it sells, and a
   * person is assigned from that second list. Checking only the first would let a manager
   * staff a counter for something the company never took up, which fails later at the counter
   * with nothing on screen to explain it.
   */
  await assertAdopted(engines)

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
    gateId: await resolveGate(scope.tenantId, input.role, engines, input.stationId, input.gateId),
    engineKinds: engines,
    /*
     * The tenant's own activities this person works.
     *
     * Kept apart from `engineKinds`, which names the activities the product ships with. A
     * tenant's key lives only in that tenant's database, so mixing the two lists would let a
     * company call an activity `MOBILITY` and inherit behaviour nobody granted it.
     */
    activityKeys: [...new Set(input.activityKeys ?? [])],
    /*
     * The job their company defined, which is where their permissions and scope come from.
     * `role` above is only the platform primitive — see the note on the user model.
     */
    roleKey: input.roleKey ?? null,
    reportsTo: await resolveReportsTo(scope.tenantId, input.role, input.reportsTo),
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

  if (patch.activityKeys !== undefined) user.activityKeys = [...new Set(patch.activityKeys)]
  if (patch.roleKey !== undefined) user.roleKey = patch.roleKey

  user.engineKinds = resolveEngines(
    user.role,
    patch.engineKinds !== undefined ? patch.engineKinds : user.engineKinds,
    user.activityKeys,
  )
  user.kioskId = await resolveKiosk(
    scope.tenantId,
    user.role,
    user.engineKinds,
    user.stationId,
    patch.kioskId !== undefined ? patch.kioskId : user.kioskId,
  )
  user.gateId = await resolveGate(
    scope.tenantId,
    user.role,
    user.engineKinds,
    user.stationId,
    patch.gateId !== undefined ? patch.gateId : user.gateId,
  )
  user.reportsTo = await resolveReportsTo(
    scope.tenantId,
    user.role,
    patch.reportsTo !== undefined ? patch.reportsTo : user.reportsTo,
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

export async function removeStaff(scope: ManagerScope, id: string) {
  const user = await User.findOne({ _id: id, tenantId: scope.tenantId })
  if (!user) throw ApiError.notFound('Staff member not found.')
  if (id === scope.userId) throw ApiError.unprocessable('You cannot remove your own account.')
  if (!(ASSIGNABLE_BY[scope.role] ?? []).includes(user.role)) {
    throw ApiError.forbidden(`A ${scope.role.replaceAll('_', ' ').toLowerCase()} may not remove a ${user.role} account.`)
  }

  const open = await Shift.countDocuments({ tenantId: scope.tenantId, agentId: id, status: { $ne: 'CLOSED' } })
  if (open > 0) throw ApiError.unprocessable('This person has an open till — reconcile and close it first.')

  user.active = false
  user.removedAt = new Date()
  user.email = `${user.email}.removed.${Date.now()}`
  await user.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'STAFF_REMOVED',
    entity: 'User',
    entityId: user._id,
    detail: `${user.fullName} (${user.role})`,
  })

  return { removed: id, name: user.fullName }
}
