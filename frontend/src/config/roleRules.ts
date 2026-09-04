import type { EngineKind, Role } from '@/models'

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

export const assignableBy = (role: Role | undefined): Role[] => (role ? (ASSIGNABLE_BY[role] ?? []) : [])

export const isActivityScoped = (role: Role): boolean => ACTIVITY_SCOPED.includes(role)
export const isKioskScoped = (role: Role): boolean => KIOSK_SCOPED.includes(role)
export const isLagoonOnly = (role: Role): boolean => LAGOON_ONLY.includes(role)
export const isSubManager = (role: Role): boolean => SUB_MANAGER_ROLES.includes(role)

export function allowedActivities(role: Role, all: EngineKind[]): EngineKind[] {
  return isLagoonOnly(role) ? all.filter((e) => e === 'LAGOON') : all
}

export const ROLE_ORDER: Role[] = [
  'TENANT_ADMIN',
  'PROJECT_MANAGER',
  'MANAGER',
  'SUPERVISOR',
  'ACCOUNTANT',
  'HR',
  'CHIEF_CAPTAIN',
  'AGENT',
  'DELIVERY_AGENT',
]
