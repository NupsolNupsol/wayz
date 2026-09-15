import { http, unwrap } from './client'

/**
 * Jobs, as the signed-in company defines them.
 *
 * Everything an employee form needs comes from here rather than from a constant. A tenant that
 * runs horse tours is offered its own jobs and its own activities; a tenant that hires a new
 * kind of person tomorrow sees them without a release.
 */

export interface RoleScope {
  sites: 'ALL' | 'ASSIGNED'
  areas: 'ALL' | 'ASSIGNED'
  terminals: 'ALL' | 'ASSIGNED'
  activities: 'ALL' | 'ASSIGNED'
  resources: 'ALL' | 'ASSIGNED' | 'BY_ACTIVITY' | 'NONE'
}

export interface RoleDefinition {
  _id: string
  key: string
  label: string
  labelAr: string
  description: string
  /** The platform's job *shape*. Not a source of permission — see the backend model. */
  baseRole: string
  permissions: string[]
  scope: RoleScope
  activityAccess: string[]
  engineAccess: string[]
  system: boolean
  active: boolean
  order: number
}

export interface PermissionDef {
  key: string
  label: string
  blurb: string
  group: string
}

export interface RoleVocabulary {
  permissions: PermissionDef[]
  groups: string[]
  keys: string[]
  baseRoles: string[]
  scopeAxes: string[]
}

/** What a job may be assigned to work, computed from the tenant right now. */
export interface Assignable {
  roleKey: string
  roleLabel: string
  baseRole: string
  scope: RoleScope
  activities: { key: string; name: string; nameAr: string; emoji: string }[]
  engineKinds: string[]
  needsTerminal: boolean
  needsSite: boolean
}

export const roleApi = {
  list: () => unwrap<RoleDefinition[]>(http.get('/roles')),
  vocabulary: () => unwrap<RoleVocabulary>(http.get('/roles/vocabulary')),
  assignable: (key: string) => unwrap<Assignable>(http.get(`/roles/${key}/assignable`)),

  create: (input: Partial<RoleDefinition> & { key: string; label: string; baseRole: string; permissions: string[] }) =>
    unwrap<RoleDefinition>(http.post('/roles', input)),
  update: (key: string, patch: Partial<RoleDefinition>) =>
    unwrap<RoleDefinition>(http.patch(`/roles/${key}`, patch)),
  remove: (key: string) => unwrap<{ removed: string }>(http.delete(`/roles/${key}`)),
}
