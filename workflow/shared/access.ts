export const AGENT = 'AGENT'
export const CASHIER = 'CASHIER'
export const DELIVERY_AGENT = 'DELIVERY_AGENT'
export const MANAGER = 'MANAGER'
export const HR = 'HR'
export const ACCOUNTANT = 'ACCOUNTANT'
export const TENANT_ADMIN = 'TENANT_ADMIN'

export const ROLES = [AGENT, CASHIER, DELIVERY_AGENT, MANAGER, HR, ACCOUNTANT, TENANT_ADMIN] as const

export type Role = (typeof ROLES)[number]

export const OPS: Role[] = [AGENT, MANAGER]

export const TILL: Role[] = [AGENT, CASHIER]

export const OVERRIDE_ROLES: Role[] = [MANAGER, TENANT_ADMIN]

export const COURIER: Role[] = [DELIVERY_AGENT]
export const KIOSK_OPS: Role[] = [AGENT, MANAGER]
