import { randomUUID } from 'node:crypto'

import { ActivityDefinition, RoleDefinition, User } from '../models/index.js'
import type { RoleDefinitionDoc } from '../models/index.js'
import { DEFAULT_SCOPE, TENANT_WIDE_SCOPE, sanitisePermissions, type RoleScope } from '../platform/permissions.js'
import { ROLES, type Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Jobs, as a tenant defines them.
 *
 * The service half of the correction described in `models/roleDefinition.model.ts`: a job is
 * a tenant-owned record composing generic permission primitives, not a name the platform
 * attaches meaning to.
 */

const KEY = /^[a-z][a-z0-9_]{1,40}$/

export interface RoleDefinitionInput {
  key: string
  label: string
  labelAr?: string
  description?: string
  baseRole: Role
  permissions: string[]
  scope?: Partial<RoleScope>
  activityAccess?: string[]
  engineAccess?: string[]
  order?: number
}

export async function listRoleDefinitions(tenantId: string) {
  return RoleDefinition.find({ tenantId }).sort({ order: 1, label: 1 }).lean()
}

/**
 * The one job every tenant gets.
 *
 * Deliberately the only one. A new tenant inherits the machinery and none of anybody else's
 * business: its administrator defines the jobs their company actually has. Handing every new
 * tenant WAYZ's nine roles is precisely the inheritance this refactor exists to stop.
 */
export function administratorTemplate(): RoleDefinitionInput {
  return {
    key: 'tenant_admin',
    label: 'Administrator',
    labelAr: 'مدير المنشأة',
    description: 'Owns this company on the platform: its structure, its people, its activities and its rules.',
    baseRole: 'TENANT_ADMIN',
    permissions: ['tenant.administer'],
    scope: TENANT_WIDE_SCOPE,
    order: 0,
  }
}

export async function createRoleDefinition(tenantId: string, input: RoleDefinitionInput, system = false) {
  const key = input.key.trim().toLowerCase()
  if (!KEY.test(key)) {
    throw ApiError.badRequest('A job key is lowercase letters, digits and underscores, starting with a letter.', [
      'Employees reference their job by this, so it cannot be changed later.',
    ])
  }
  if (!ROLES.includes(input.baseRole)) {
    throw ApiError.badRequest(`"${input.baseRole}" is not one of the platform's job shapes.`)
  }

  const clash = await RoleDefinition.findOne({ tenantId, key }).lean()
  if (clash) throw ApiError.conflict(`A job already uses the key "${key}".`)

  return RoleDefinition.create({
    _id: `role_${randomUUID()}`,
    tenantId,
    key,
    label: input.label.trim(),
    labelAr: input.labelAr?.trim() ?? '',
    description: input.description?.trim() ?? '',
    baseRole: input.baseRole,
    permissions: sanitisePermissions(input.permissions),
    scope: { ...DEFAULT_SCOPE, ...(input.scope ?? {}) },
    activityAccess: [...new Set(input.activityAccess ?? [])],
    engineAccess: [...new Set(input.engineAccess ?? [])],
    system,
    active: true,
    order: input.order ?? 50,
  })
}

export async function updateRoleDefinition(tenantId: string, key: string, patch: Partial<RoleDefinitionInput> & { active?: boolean }) {
  const row = await RoleDefinition.findOne({ tenantId, key })
  if (!row) throw ApiError.notFound('No such job.')

  if (patch.label !== undefined) row.label = patch.label.trim()
  if (patch.labelAr !== undefined) row.labelAr = patch.labelAr.trim()
  if (patch.description !== undefined) row.description = patch.description.trim()
  if (patch.baseRole !== undefined) {
    if (!ROLES.includes(patch.baseRole)) throw ApiError.badRequest(`"${patch.baseRole}" is not one of the platform's job shapes.`)
    row.baseRole = patch.baseRole
  }
  if (patch.permissions !== undefined) row.permissions = sanitisePermissions(patch.permissions)
  if (patch.scope !== undefined) row.scope = { ...row.scope, ...patch.scope }
  if (patch.activityAccess !== undefined) row.activityAccess = [...new Set(patch.activityAccess)]
  if (patch.engineAccess !== undefined) row.engineAccess = [...new Set(patch.engineAccess)]
  if (patch.order !== undefined) row.order = patch.order

  if (patch.active !== undefined) {
    /*
     * A tenant must keep somebody who can administer it.
     *
     * Standing this job down would leave a company nobody can configure, recoverable only
     * from the control plane. Refusing is kinder than the support call.
     */
    if (!patch.active && row.system) {
      throw ApiError.badRequest(`"${row.label}" is what keeps this company administrable and cannot be stood down.`)
    }
    row.active = patch.active
  }

  await row.save()
  return row.toObject()
}

/**
 * Removes a job nobody holds.
 *
 * Refused the moment somebody does, because an employee whose job no longer exists has no
 * permissions and no obvious way to be given any — a worse state than a cluttered list.
 */
export async function removeRoleDefinition(tenantId: string, key: string) {
  const row = await RoleDefinition.findOne({ tenantId, key }).lean<RoleDefinitionDoc>()
  if (!row) throw ApiError.notFound('No such job.')
  if (row.system) throw ApiError.badRequest(`"${row.label}" is part of how this company is administered and cannot be removed.`)

  const held = await User.countDocuments({ tenantId, roleKey: key })
  if (held > 0) {
    throw ApiError.badRequest(`${held} person(s) hold "${row.label}".`, [
      'Move them to another job first, or stand this one down instead — it stops being offered and everybody keeps working.',
    ])
  }

  await RoleDefinition.deleteOne({ tenantId, key })
  return { removed: key }
}

/**
 * What a job may be assigned to work, right now.
 *
 * Everything an employee form needs, computed from the tenant rather than from a constant:
 * the activities this job is allowed to operate, and the built-in engines it may work if the
 * tenant runs any. A newly published activity appears here with no deployment, which is the
 * property the client asked for by name.
 */
export async function assignableForRole(tenantId: string, roleKey: string) {
  const role = await RoleDefinition.findOne({ tenantId, key: roleKey }).lean<RoleDefinitionDoc>()
  if (!role) throw ApiError.notFound('No such job.')

  const published = await ActivityDefinition.find(
    { tenantId, status: 'PUBLISHED', currentRevision: { $gt: 0 } },
    { key: 1, name: 1, nameAr: 1, emoji: 1, revisions: 1, currentRevision: 1 },
  )
    .sort({ name: 1 })
    .lean()

  const activities = published
    .filter((a) => {
      /*
       * Two gates, and either may be silent.
       *
       * The job may name the activities it works; the activity may name the jobs that may
       * operate it. Where both are silent the pairing is allowed, which is what lets a small
       * tenant work without wiring anything up.
       */
      const allowedByRole = role.activityAccess.length === 0 || role.activityAccess.includes(a.key)
      const revision = a.revisions.find((r) => r.revision === a.currentRevision)
      const operators = revision?.operatorRoleKeys ?? []
      const allowedByActivity = operators.length === 0 || operators.includes(roleKey)
      return allowedByRole && allowedByActivity
    })
    .map((a) => ({ key: a.key, name: a.name, nameAr: a.nameAr, emoji: a.emoji }))

  return {
    roleKey: role.key,
    roleLabel: role.label,
    baseRole: role.baseRole,
    scope: role.scope,
    activities,
    /* Built-in engines only where the tenant's own job says it works them. */
    engineKinds: role.engineAccess,
    needsTerminal: role.scope.terminals === 'ASSIGNED',
    needsSite: role.scope.sites === 'ASSIGNED',
  }
}
