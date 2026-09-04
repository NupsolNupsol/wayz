import type { Role } from './types.js'

export type ScopeLevel = 'kiosk' | 'activity' | 'tenant'

export const SCOPE_LEVEL: Record<Role, ScopeLevel> = {
  AGENT: 'kiosk',
  CHIEF_CAPTAIN: 'kiosk',

  SUPERVISOR: 'activity',
  MANAGER: 'activity',

  DELIVERY_AGENT: 'tenant',
  PROJECT_MANAGER: 'tenant',
  HR: 'tenant',
  ACCOUNTANT: 'tenant',
  TENANT_ADMIN: 'tenant',
}

export const ACTIVITY_SCOPED: Role[] = ['AGENT', 'SUPERVISOR', 'MANAGER', 'CHIEF_CAPTAIN']

export const KIOSK_SCOPED: Role[] = ['AGENT', 'CHIEF_CAPTAIN']

export const LAGOON_ONLY: Role[] = ['CHIEF_CAPTAIN']

export const SUB_MANAGER_ROLES: Role[] = ['MANAGER', 'SUPERVISOR']

export const isKioskScoped = (role: Role): boolean => KIOSK_SCOPED.includes(role)
export const isActivityScoped = (role: Role): boolean => ACTIVITY_SCOPED.includes(role)

export const ASSIGNABLE_BY: Partial<Record<Role, Role[]>> = {
  TENANT_ADMIN: [
    'AGENT',
    'DELIVERY_AGENT',
    'SUPERVISOR',
    'CHIEF_CAPTAIN',
    'MANAGER',
    'PROJECT_MANAGER',
    'HR',
    'ACCOUNTANT',
  ],
  PROJECT_MANAGER: ['AGENT', 'DELIVERY_AGENT', 'SUPERVISOR', 'CHIEF_CAPTAIN', 'MANAGER'],
  MANAGER: ['AGENT', 'DELIVERY_AGENT', 'SUPERVISOR', 'CHIEF_CAPTAIN'],
}

export const canAssign = (actor: Role, target: Role): boolean => (ASSIGNABLE_BY[actor] ?? []).includes(target)

export const FLOOR_LEADS: Role[] = ['SUPERVISOR', 'MANAGER', 'PROJECT_MANAGER', 'TENANT_ADMIN']

export const BACK_OFFICE: Role[] = ['MANAGER', 'PROJECT_MANAGER', 'TENANT_ADMIN']

export const ESTATE_OWNERS: Role[] = [...BACK_OFFICE, 'HR']

export const ESTATE_READERS: Role[] = [
  ...ESTATE_OWNERS,
  'SUPERVISOR',
  'AGENT',
  'CHIEF_CAPTAIN',
]

export const DESK_STAFF: Role[] = ['AGENT', 'CHIEF_CAPTAIN']

export const SELLING_STAFF: Role[] = ['AGENT']
