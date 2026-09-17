import type { EngineKind, Role } from '@/models';

export type ScopeLevel = 'kiosk' | 'activity' | 'tenant';

export const SCOPE_LEVEL: Record<Role, ScopeLevel> = {
  AGENT: 'kiosk',

  /*
   * A chief captain answers for the water, not for a counter.
   *
   * They were desk-scoped, which meant two things that were both wrong: hiring one required
   * choosing a jetty for them, and everything they could see was filtered to that jetty. A
   * station runs several lagoon desks, so a party sold at one counter raised a task the
   * captain standing at another could not see — the boat filled and nobody was called.
   *
   * Activity-scoped instead: they see every boat and every trip at their station, and the
   * desk that happened to sell the seats is irrelevant to whether they are told about them.
   *
   * Kept identical to `backend/src/domain/roles.ts`, which is the authority.
   */
  CHIEF_CAPTAIN: 'activity',

  SUPERVISOR: 'activity',
  MANAGER: 'activity',
  DELIVERY_AGENT: 'tenant',
  PROJECT_MANAGER: 'tenant',
  HR: 'tenant',
  ACCOUNTANT: 'tenant',
  TENANT_ADMIN: 'tenant',
};

export const ACTIVITY_SCOPED: Role[] = ['AGENT', 'SUPERVISOR', 'MANAGER', 'CHIEF_CAPTAIN'];

/**
 * Jobs that answer for one counter, and must be given one when they are hired.
 *
 * A chief captain is deliberately not here: see SCOPE_LEVEL above. They may still be recorded
 * against a jetty for the roster, but nothing they can see depends on it.
 */
export const KIOSK_SCOPED: Role[] = ['AGENT'];

export const LAGOON_ONLY: Role[] = ['CHIEF_CAPTAIN'];

export const SUB_MANAGER_ROLES: Role[] = ['MANAGER', 'SUPERVISOR'];

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
};

export const assignableBy = (role: Role | undefined): Role[] =>
  role ? (ASSIGNABLE_BY[role] ?? []) : [];

export const isActivityScoped = (role: Role): boolean => ACTIVITY_SCOPED.includes(role);
export const isKioskScoped = (role: Role): boolean => KIOSK_SCOPED.includes(role);
export const isLagoonOnly = (role: Role): boolean => LAGOON_ONLY.includes(role);
export const isSubManager = (role: Role): boolean => SUB_MANAGER_ROLES.includes(role);

export function allowedActivities(role: Role, all: EngineKind[]): EngineKind[] {
  return isLagoonOnly(role) ? all.filter((e) => e === 'LAGOON') : all;
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
];
