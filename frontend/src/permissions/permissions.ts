import type { Role } from '@/models'

export type Permission =
  | 'pos.use'
  | 'booking.create'
  | 'capacity.hold'
  | 'deposit.capture'
  | 'storage.confirm'
  | 'operation.start'
  | 'retrieval.perform'
  | 'incident.report'
  | 'shift.blindCount'
  | 'refund.request'
  | 'customer.manage'
  | 'assets.view'
  | 'assets.manage'
  | 'manager.workspace'
  | 'delivery.request'
  | 'delivery.release'
  | 'delivery.carry'
  | 'till.operate'
  | 'till.refund'
  | 'tenant.administer'
  | 'accounting.read'
  | 'costs.record'

const PERMISSION_ROLES: Record<Permission, Role[]> = {
  'pos.use': ['AGENT', 'CASHIER'],
  'booking.create': ['AGENT'],
  'capacity.hold': ['AGENT'],
  'deposit.capture': ['AGENT', 'CASHIER'],
  'storage.confirm': ['AGENT'],
  'operation.start': ['AGENT'],
  'retrieval.perform': ['AGENT'],
  'incident.report': ['AGENT'],
  'shift.blindCount': ['AGENT', 'CASHIER'],
  'refund.request': ['AGENT', 'CASHIER', 'MANAGER'],
  'customer.manage': ['AGENT'],
  'assets.view': ['AGENT', 'MANAGER', 'TENANT_ADMIN', 'HR'],
  'assets.manage': ['MANAGER', 'TENANT_ADMIN', 'HR'],
  'manager.workspace': ['MANAGER', 'TENANT_ADMIN'],
  'tenant.administer': ['TENANT_ADMIN'],
  'accounting.read': ['ACCOUNTANT', 'TENANT_ADMIN'],
  'costs.record': ['HR', 'TENANT_ADMIN'],
  'delivery.request': ['AGENT'],
  'delivery.release': ['AGENT'],
  'delivery.carry': ['DELIVERY_AGENT'],
  'till.operate': ['CASHIER', 'AGENT'],
  'till.refund': ['CASHIER', 'MANAGER'],
}

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSION_ROLES[permission].includes(role)
}

export const AGENT_ROLES: Role[] = ['AGENT']

export const MANAGER_ROLES: Role[] = ['MANAGER', 'TENANT_ADMIN']

export const TENANT_ADMIN_ROLES: Role[] = ['TENANT_ADMIN']

export const ACCOUNTANT_ROLES: Role[] = ['ACCOUNTANT']

export const HR_ROLES: Role[] = ['HR']

export const COURIER_ROLES: Role[] = ['DELIVERY_AGENT']

export const CASHIER_ROLES: Role[] = ['CASHIER']

/** The estate is one page; these are everyone who may open it. */
export const ASSET_ROLES: Role[] = ['MANAGER', 'TENANT_ADMIN', 'HR', 'AGENT']

export const DOCS_ROLES: Role[] = [
  ...AGENT_ROLES,
  ...MANAGER_ROLES,
  ...COURIER_ROLES,
  ...CASHIER_ROLES,
  ...ACCOUNTANT_ROLES,
  ...HR_ROLES,
]

export function isAgentRole(role: Role | undefined): boolean {
  return !!role && AGENT_ROLES.includes(role)
}

export function isCourierRole(role: Role | undefined): boolean {
  return !!role && COURIER_ROLES.includes(role)
}

export function isCashierRole(role: Role | undefined): boolean {
  return !!role && CASHIER_ROLES.includes(role)
}

export function isTenantAdminRole(role: Role | undefined): boolean {
  return !!role && TENANT_ADMIN_ROLES.includes(role)
}

export function isAccountantRole(role: Role | undefined): boolean {
  return !!role && ACCOUNTANT_ROLES.includes(role)
}

export function isHrRole(role: Role | undefined): boolean {
  return !!role && HR_ROLES.includes(role)
}

export function homeForRole(role: Role | undefined): string {
  if (isTenantAdminRole(role)) return '/admin'
  if (isAccountantRole(role)) return '/accounting'
  if (isHrRole(role)) return '/hr'
  if (isCourierRole(role)) return '/courier'
  if (isCashierRole(role)) return '/cashier'
  if (role && MANAGER_ROLES.includes(role)) return '/manager'
  if (isAgentRole(role)) return '/dashboard'
  if (role) return '/no-workspace'
  return '/login'
}
