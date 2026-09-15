import { RoleDefinition, User, type RoleDefinitionDoc, type UserDoc } from '../models/index.js'
import { DEFAULT_SCOPE, PERMISSION_KEYS, TENANT_WIDE_SCOPE, type RoleScope } from '../platform/permissions.js'
import type { Role } from '../domain/types.js'

/**
 * What one person may actually do, in one place.
 *
 * Everything that used to be answered by asking "what is this person's role called?" is
 * answered here instead, by reading the job their own company defined. The role name is a
 * label; this is the policy.
 *
 * ## The five things that decide access
 *
 * A person's effective reach is the intersection of:
 *
 * ```
 * tenant  ∩  permissions  ∩  locations  ∩  activities  ∩  resource eligibility
 * ```
 *
 * Nothing in that chain mentions an engine, an activity name or a tenant. A horse trainer at
 * one WIQAR location and a scooter agent at a WAYZ gate are computed by the same code.
 */

export interface EffectiveAccess {
  tenantId: string
  userId: string
  /** The platform primitive — the *shape* of the job, never a source of permission. */
  baseRole: Role
  /** The tenant's own job, when they have defined one. */
  roleKey: string | null
  roleLabel: string
  permissions: Set<string>
  scope: RoleScope
  /** Where they are posted. Empty when their scope is ALL on that axis. */
  siteIds: string[]
  areaIds: string[]
  terminalIds: string[]
  /** The tenant's own activities they work. */
  activityKeys: string[]
  /** Built-in engines they work, for a tenant that runs them. */
  engineKinds: string[]
}

/**
 * The fallback for a tenant that has not defined its jobs yet.
 *
 * WAYZ predates role definitions and has eighteen people already posted, so it cannot be
 * required to define its jobs before anybody can sign in. Where a tenant has no definition
 * for a base role, the platform grants the reach that base role has always had.
 *
 * This is a migration affordance, not the design. A tenant with definitions never touches it,
 * and it grants nothing an existing installation did not already have.
 */
const LEGACY_BASE_PERMISSIONS: Record<Role, string[]> = {
  TENANT_ADMIN: ['tenant.administer'],
  PROJECT_MANAGER: [
    'employees.read', 'employees.manage', 'roles.read', 'sites.read', 'sites.manage',
    'areas.read', 'areas.manage', 'terminals.read', 'terminals.manage', 'activities.read',
    'activities.manage', 'activities.publish', 'resources.read', 'resources.manage',
    'bookings.read', 'bookings.manage', 'sessions.read', 'sessions.manage', 'sessions.override',
    'customers.read', 'customers.manage', 'incidents.report', 'incidents.resolve',
    'till.operate', 'till.reconcile', 'finance.read', 'refunds.approve', 'pricing.manage',
    'discounts.approve', 'inventory.read', 'inventory.manage', 'reports.read', 'tenant.configure',
  ],
  MANAGER: [
    'employees.read', 'employees.manage', 'sites.read', 'areas.read', 'terminals.read',
    'terminals.manage', 'activities.read', 'activities.manage', 'activities.publish',
    'resources.read', 'resources.manage', 'bookings.read', 'bookings.manage', 'sessions.read',
    'sessions.manage', 'sessions.override', 'customers.read', 'customers.manage',
    'incidents.report', 'incidents.resolve', 'till.operate', 'till.reconcile', 'finance.read',
    'refunds.approve', 'pricing.manage', 'discounts.approve', 'inventory.read',
    'inventory.manage', 'reports.read', 'tenant.configure',
  ],
  SUPERVISOR: [
    'employees.read', 'sites.read', 'areas.read', 'terminals.read', 'activities.read',
    'resources.read', 'resources.assign', 'bookings.read', 'bookings.manage', 'sessions.read',
    'sessions.manage', 'sessions.override', 'customers.read', 'customers.manage',
    'incidents.report', 'incidents.resolve', 'till.operate', 'till.reconcile',
    'refunds.request', 'inventory.read', 'reports.read',
  ],
  AGENT: [
    'pos.use', 'bookings.read', 'bookings.manage', 'sessions.read', 'sessions.manage',
    'customers.read', 'customers.manage', 'incidents.report', 'resources.read',
    'resources.assign', 'till.operate', 'refunds.request', 'activities.read', 'retail.sell',
  ],
  CHIEF_CAPTAIN: [
    'sessions.read', 'sessions.manage', 'resources.read', 'resources.assign',
    'incidents.report', 'activities.read', 'bookings.read',
  ],
  DELIVERY_AGENT: ['transfers.execute', 'bookings.read', 'incidents.report'],
  ACCOUNTANT: [
    'finance.read', 'finance.write', 'finance.reconcile', 'reports.read', 'reports.financial',
    'reports.export', 'refunds.request', 'inventory.read', 'bookings.read',
  ],
  HR: [
    'employees.read', 'employees.manage', 'attendance.read', 'attendance.manage',
    'leave.approve', 'payroll.read', 'finance.write', 'reports.read',
  ],
}

/** How far each base role has always been able to see. */
const LEGACY_BASE_SCOPE: Record<Role, RoleScope> = {
  TENANT_ADMIN: TENANT_WIDE_SCOPE,
  PROJECT_MANAGER: TENANT_WIDE_SCOPE,
  ACCOUNTANT: TENANT_WIDE_SCOPE,
  HR: TENANT_WIDE_SCOPE,
  DELIVERY_AGENT: { ...TENANT_WIDE_SCOPE, resources: 'ALL' },
  MANAGER: { sites: 'ALL', areas: 'ALL', terminals: 'ALL', activities: 'ASSIGNED', resources: 'BY_ACTIVITY' },
  SUPERVISOR: { sites: 'ALL', areas: 'ALL', terminals: 'ALL', activities: 'ASSIGNED', resources: 'BY_ACTIVITY' },
  CHIEF_CAPTAIN: { sites: 'ASSIGNED', areas: 'ALL', terminals: 'ALL', activities: 'ASSIGNED', resources: 'BY_ACTIVITY' },
  AGENT: { ...DEFAULT_SCOPE },
}

export interface PersonLike {
  _id: string
  tenantId: string
  role: Role
  roleKey?: string | null
  siteId?: string | null
  stationId?: string | null
  kioskId?: string | null
  activityKeys?: string[] | null
  engineKinds?: string[] | null
}

/**
 * Resolves what a person may do.
 *
 * Their company's definition of their job decides it. Only where the company has not defined
 * that job does the platform fall back to what the base role has always granted — see the
 * note on `LEGACY_BASE_PERMISSIONS`.
 */
export async function effectiveAccess(person: PersonLike): Promise<EffectiveAccess> {
  const definition = person.roleKey
    ? await RoleDefinition.findOne({ tenantId: person.tenantId, key: person.roleKey, active: true }).lean<RoleDefinitionDoc>()
    : null

  const permissions = new Set(
    definition ? definition.permissions : (LEGACY_BASE_PERMISSIONS[person.role] ?? []),
  )
  const scope = definition ? definition.scope : (LEGACY_BASE_SCOPE[person.role] ?? DEFAULT_SCOPE)

  /*
   * Administering the company implies everything.
   *
   * Expanded here rather than written into every definition, so a permission added next month
   * reaches the administrator without anybody remembering to grant it.
   */
  if (permissions.has('tenant.administer')) {
    for (const key of PERMISSION_KEYS) permissions.add(key)
  }

  return {
    tenantId: person.tenantId,
    userId: person._id,
    baseRole: person.role,
    roleKey: definition?.key ?? null,
    roleLabel: definition?.label ?? person.role,
    permissions,
    scope,
    siteIds: person.siteId ? [person.siteId] : [],
    areaIds: person.stationId ? [person.stationId] : [],
    terminalIds: person.kioskId ? [person.kioskId] : [],
    activityKeys: [...new Set(person.activityKeys ?? [])],
    engineKinds: [...new Set(person.engineKinds ?? [])],
  }
}

export const holds = (access: EffectiveAccess, permission: string): boolean =>
  access.permissions.has(permission)

/**
 * The locations this person may read, as a Mongo filter fragment.
 *
 * `{}` when they see everywhere — deliberately, so a caller can spread it into a query and
 * never has to branch on the scope mode itself.
 */
export function siteFilter(access: EffectiveAccess): Record<string, unknown> {
  if (access.scope.sites === 'ALL') return {}
  return { siteId: { $in: access.siteIds } }
}

export function areaFilter(access: EffectiveAccess): Record<string, unknown> {
  if (access.scope.areas === 'ALL') return {}
  return { stationId: { $in: access.areaIds } }
}

export function terminalFilter(access: EffectiveAccess): Record<string, unknown> {
  if (access.scope.terminals === 'ALL') return {}
  return { kioskId: { $in: access.terminalIds } }
}

/* ------------------------------------------------------------------------------------- */
/* Resolving a request's access                                                             */
/* ------------------------------------------------------------------------------------- */

/** Where the resolved access is parked for the rest of the request. */
const CACHE = Symbol('lockerflow.access')

interface RequestLike {
  auth?: { sub?: string; tenantId?: string }
  [CACHE]?: Promise<EffectiveAccess>
}

/**
 * What the caller of this request may do.
 *
 * Read from the database rather than from the token, deliberately. A token is issued once and
 * lives for hours; a job's permissions are edited by an administrator and must take effect at
 * the next request, not at the next sign-in. Putting permissions in the token would mean an
 * administrator who revokes somebody's access has not actually revoked it — which is the kind
 * of thing that is only discovered afterwards.
 *
 * The cost is one indexed read per request, memoised on the request object so that a handler
 * asking three times pays for it once.
 */
export async function accessForRequest(req: RequestLike): Promise<EffectiveAccess> {
  const cached = req[CACHE]
  if (cached) return cached

  const userId = req.auth?.sub
  if (!userId) throw new Error('accessForRequest called outside an authenticated request.')

  const resolved = (async () => {
    const person = await User.findById(userId).lean<UserDoc>()
    if (!person) throw new Error(`No such person: ${userId}`)
    return effectiveAccess(person as unknown as PersonLike)
  })()

  req[CACHE] = resolved
  return resolved
}
