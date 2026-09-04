import type { Role } from '@/models'

export type Permission =
  | 'rules.edit'
  | 'pos.use'
  | 'booking.create'
  | 'capacity.hold'
  | 'deposit.capture'
  | 'storage.confirm'
  | 'operation.start'
  | 'retrieval.perform'
  | 'incident.report'
  | 'pricing.edit'
  | 'trip.plan'
  | 'trip.sail'
  | 'shift.blindCount'
  | 'shift.reconcile'
  | 'refund.request'
  | 'customer.manage'
  | 'assets.view'
  | 'assets.manage'
  | 'manager.workspace'
  | 'manager.configure'
  | 'delivery.request'
  | 'delivery.release'
  | 'delivery.carry'
  | 'till.operate'
  | 'till.refund'
  | 'refund.approve'
  | 'tenant.administer'
  | 'accounting.read'
  | 'costs.record'
  | 'sales.enterManual'
  | 'sales.approveManual'

export const DESK_ROLES: Role[] = ['AGENT', 'CHIEF_CAPTAIN']

export const SELLING_ROLES: Role[] = ['AGENT']

export const FLOOR_LEADS: Role[] = ['SUPERVISOR', 'MANAGER', 'PROJECT_MANAGER', 'TENANT_ADMIN']

export const BACK_OFFICE: Role[] = ['MANAGER', 'PROJECT_MANAGER', 'TENANT_ADMIN']

const PERMISSION_ROLES: Record<Permission, Role[]> = {
  'pos.use': SELLING_ROLES,
  'booking.create': SELLING_ROLES,
  'capacity.hold': SELLING_ROLES,
  'deposit.capture': SELLING_ROLES,
  'storage.confirm': ['AGENT'],
  'operation.start': SELLING_ROLES,
  'retrieval.perform': SELLING_ROLES,
  'incident.report': DESK_ROLES,
  'pricing.edit': [...BACK_OFFICE, 'HR'],
  'trip.plan': ['AGENT', ...FLOOR_LEADS],
  'trip.sail': ['CHIEF_CAPTAIN'],
  'shift.blindCount': [...SELLING_ROLES, 'DELIVERY_AGENT'],
  'shift.reconcile': FLOOR_LEADS,
  'refund.request': [...SELLING_ROLES, ...FLOOR_LEADS],
  'customer.manage': SELLING_ROLES,
  'assets.view': [...DESK_ROLES, ...FLOOR_LEADS, 'HR'],
  'assets.manage': [...BACK_OFFICE, 'HR'],
  'manager.workspace': FLOOR_LEADS,
  'manager.configure': BACK_OFFICE,
  'tenant.administer': ['TENANT_ADMIN'],
  'accounting.read': ['ACCOUNTANT', 'TENANT_ADMIN'],
  'costs.record': ['HR', 'TENANT_ADMIN'],
  'delivery.request': SELLING_ROLES,
  'delivery.release': SELLING_ROLES,
  'delivery.carry': ['DELIVERY_AGENT'],
  'till.operate': [...SELLING_ROLES, ...FLOOR_LEADS],
  'till.refund': BACK_OFFICE,
  'refund.approve': BACK_OFFICE,
  'rules.edit': BACK_OFFICE,
  'sales.enterManual': ['ACCOUNTANT', ...FLOOR_LEADS],
  'sales.approveManual': ['TENANT_ADMIN'],
}

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSION_ROLES[permission].includes(role)
}

export const AGENT_ROLES: Role[] = DESK_ROLES

export const MANAGER_ROLES: Role[] = FLOOR_LEADS

export const TENANT_ADMIN_ROLES: Role[] = ['TENANT_ADMIN']

export const BACK_OFFICE_ROLES: Role[] = BACK_OFFICE

export const ACCOUNTANT_ROLES: Role[] = ['ACCOUNTANT']

export const HR_ROLES: Role[] = ['HR']

export const COURIER_ROLES: Role[] = ['DELIVERY_AGENT']

export const TILL_ROLES: Role[] = [...SELLING_ROLES, ...FLOOR_LEADS]

export const ASSET_ROLES: Role[] = [...DESK_ROLES, ...FLOOR_LEADS, 'HR']

export const ALL_ROLES: Role[] = [
  'AGENT',
  'CHIEF_CAPTAIN',
  'DELIVERY_AGENT',
  'SUPERVISOR',
  'MANAGER',
  'PROJECT_MANAGER',
  'HR',
  'ACCOUNTANT',
  'TENANT_ADMIN',
]

export const MANUAL_SALES_ROLES: Role[] = ['ACCOUNTANT', ...FLOOR_LEADS]

export const REFUND_APPROVER_ROLES: Role[] = BACK_OFFICE
export const REFUND_QUEUE_ROLES: Role[] = [...DESK_ROLES, ...FLOOR_LEADS]

export const DOCS_ROLES: Role[] = [
  ...DESK_ROLES,
  ...FLOOR_LEADS,
  ...COURIER_ROLES,
  ...ACCOUNTANT_ROLES,
  ...HR_ROLES,
]

export function isAgentRole(role: Role | undefined): boolean {
  return !!role && AGENT_ROLES.includes(role)
}

export function isCourierRole(role: Role | undefined): boolean {
  return !!role && COURIER_ROLES.includes(role)
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

export function isSupervisorRole(role: Role | undefined): boolean {
  return role === 'SUPERVISOR'
}

export function homeForRole(role: Role | undefined): string {
  if (isTenantAdminRole(role)) return '/admin'
  if (isAccountantRole(role)) return '/accounting'
  if (isHrRole(role)) return '/hr'
  if (isCourierRole(role)) return '/courier'
  if (role === 'CHIEF_CAPTAIN') return '/lagoon/captain'
  if (role && MANAGER_ROLES.includes(role)) return '/manager'
  if (isAgentRole(role)) return '/dashboard'
  if (role) return '/no-workspace'
  return '/login'
}
