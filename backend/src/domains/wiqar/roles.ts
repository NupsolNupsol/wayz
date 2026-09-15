import { DEFAULT_SCOPE, TENANT_WIDE_SCOPE, type RoleScope } from '../../platform/permissions.js'
import type { Role } from '../../domain/types.js'

/**
 * WIQAR's jobs, as WIQAR's own requirements define them.
 *
 * Taken from the Ana'am Experience functional specification, §3.3 (organisational hierarchy),
 * §3.2 (per-location staff) and §10 (user stories). **Not** derived from WAYZ: the two
 * companies share the platform's machinery and none of its business meaning.
 *
 * This file is tenant configuration that happens to live in the repository, in the same way
 * WAYZ's seed does. It is read once, at provisioning, and written into WIQAR's own database
 * as role definitions its administrator can then edit. Nothing in the platform reads it at
 * runtime, and nothing outside WIQAR's provisioning imports it.
 *
 * Two decisions taken straight from the specification and worth knowing:
 *
 *   - **Cleaners get no account.** §3.2 says "no system access", so there is no role for them.
 *     A job nobody can sign in as should not exist as a login.
 *   - **A purchasing agent cannot approve their own orders.** §3.3 says so explicitly, so the
 *     role holds `procurement.create` and not `procurement.approve`.
 */

export interface WiqarRoleTemplate {
  key: string
  label: string
  labelAr: string
  description: string
  /** The platform primitive — the shape of the job, never a source of permission. */
  baseRole: Role
  permissions: string[]
  scope: RoleScope
  /** Which activities this job may work. Empty means any the tenant publishes. */
  activityAccess: string[]
  order: number
}

/** Sees and does everything, across every location. §3.3 level 1. */
const CEO: WiqarRoleTemplate = {
  key: 'ceo',
  label: 'CEO',
  labelAr: 'الرئيس التنفيذي',
  description: 'Full access to every module, configuration and record, across all locations.',
  baseRole: 'TENANT_ADMIN',
  permissions: ['tenant.administer'],
  scope: TENANT_WIDE_SCOPE,
  activityAccess: [],
  order: 0,
}

/** Everything operational for their locations, but not payroll. §3.3 level 2. */
const PROJECT_MANAGER: WiqarRoleTemplate = {
  key: 'project_manager',
  label: 'Project manager',
  labelAr: 'مدير المشروع',
  description:
    'All modules for their locations; approves purchases, transfers and complimentary requests; sees site financials. Cannot modify payroll.',
  baseRole: 'PROJECT_MANAGER',
  permissions: [
    'employees.read', 'employees.manage', 'roles.read',
    'sites.read', 'sites.manage', 'areas.read', 'areas.manage', 'terminals.read', 'terminals.manage',
    'activities.read', 'activities.manage', 'activities.publish',
    'resources.read', 'resources.manage', 'resources.assign', 'resources.clear',
    'maintenance.read', 'maintenance.manage',
    'bookings.read', 'bookings.manage', 'sessions.read', 'sessions.manage', 'sessions.override',
    'customers.read', 'customers.manage', 'incidents.report', 'incidents.resolve',
    'transfers.approve', 'transfers.execute',
    'till.operate', 'till.reconcile', 'finance.read', 'finance.write', 'refunds.approve',
    'pricing.manage', 'discounts.approve',
    'inventory.read', 'inventory.manage', 'inventory.transfer',
    'procurement.read', 'procurement.approve', 'procurement.receive',
    'attendance.read', 'leave.approve',
    'reports.read', 'reports.financial', 'reports.export', 'audit.read',
  ],
  scope: TENANT_WIDE_SCOPE,
  activityAccess: [],
  order: 1,
}

/** HR, attendance, payroll, contracts. No POS, no accounting. §3.3 level 2. */
const ADMIN_MANAGER: WiqarRoleTemplate = {
  key: 'administrative_manager',
  label: 'Administrative manager',
  labelAr: 'المدير الإداري',
  description:
    'HR, attendance, payroll and contracts; onboarding and offboarding across all locations. No point of sale, no accounting.',
  baseRole: 'HR',
  permissions: [
    'employees.read', 'employees.manage', 'users.read', 'users.manage', 'roles.read',
    'attendance.read', 'attendance.manage', 'leave.approve', 'payroll.read',
    'procurement.approve',
    'reports.read', 'reports.export',
  ],
  scope: TENANT_WIDE_SCOPE,
  activityAccess: [],
  order: 2,
}

/**
 * Accounting, POS reports, inventory valuation, payroll approval. §3.3 level 2.
 *
 * The role the client used to make the point: it shares `finance.read` and `refunds.request`
 * with WAYZ's accountant and holds `payroll.approve`, `inventory.valuation` and
 * `procurement.financial` — which WAYZ's does not. Same word, different job.
 */
const CHIEF_ACCOUNTANT: WiqarRoleTemplate = {
  key: 'chief_accountant',
  label: 'Chief accountant',
  labelAr: 'المحاسب الرئيسي',
  description:
    'Accounting, point-of-sale reports, inventory valuation and payroll approval; profit and loss per location. Cannot alter a recorded transaction.',
  baseRole: 'ACCOUNTANT',
  permissions: [
    'finance.read', 'finance.write', 'finance.approve', 'finance.reconcile',
    'payroll.read', 'payroll.approve',
    'inventory.read', 'inventory.valuation',
    // Raised by the purchasing agent, approved here. Separation of duties is the whole reason
    // those are two jobs rather than one, and it only holds if this half exists.
    'procurement.read', 'procurement.approve',
    'refunds.request', 'refunds.approve',
    'bookings.read', 'reports.read', 'reports.financial', 'reports.export', 'audit.read',
  ],
  scope: TENANT_WIDE_SCOPE,
  activityAccess: [],
  order: 3,
}

/** Everything, including hardware and accounts. §3.3 level 2 — "no restrictions". */
const IT_MANAGER: WiqarRoleTemplate = {
  key: 'it_manager',
  label: 'IT manager',
  labelAr: 'مدير تقنية المعلومات',
  description:
    'Full access to every module and configuration, including system settings, user accounts and terminal hardware.',
  baseRole: 'TENANT_ADMIN',
  permissions: ['tenant.administer'],
  scope: TENANT_WIDE_SCOPE,
  activityAccess: [],
  order: 4,
}

/** Raises orders; cannot approve their own. §3.3 level 2, stated explicitly. */
const PURCHASING_AGENT: WiqarRoleTemplate = {
  key: 'purchasing_agent',
  label: 'Purchasing agent',
  labelAr: 'مسؤول المشتريات',
  description:
    'Raises and tracks purchase orders for feed, veterinary supplies, retail stock and equipment. Cannot approve their own requests; no payroll access.',
  baseRole: 'ACCOUNTANT',
  permissions: [
    'procurement.read', 'procurement.create', 'procurement.receive',
    'inventory.read', 'inventory.manage',
    'finance.read', 'finance.write',
    'reports.read',
  ],
  scope: TENANT_WIDE_SCOPE,
  activityAccess: [],
  order: 5,
}

/** Reads visitor data and sales figures for their location. Writes nothing. §3.3 level 2. */
const MARKETING_SUPERVISOR: WiqarRoleTemplate = {
  key: 'marketing_supervisor',
  label: 'Marketing supervisor',
  labelAr: 'مشرف التسويق',
  description:
    'Read-only access to visitor data and sales figures for their location; on-site promotion. No financial, HR or operational write access.',
  baseRole: 'SUPERVISOR',
  permissions: ['customers.read', 'bookings.read', 'activities.read', 'reports.read'],
  scope: { sites: 'ASSIGNED', areas: 'ALL', terminals: 'ALL', activities: 'ALL', resources: 'NONE' },
  activityAccess: [],
  order: 6,
}

/** Floor lead for a location. §10.1 US-04, §10.3 US-11. */
const SUPERVISOR: WiqarRoleTemplate = {
  key: 'supervisor',
  label: 'Supervisor',
  labelAr: 'مشرف',
  description:
    'Runs the floor at their location: overrides slots and capacity with a reason, clears animals back to service, and counts the shop at end of day.',
  baseRole: 'SUPERVISOR',
  permissions: [
    'employees.read', 'sites.read', 'areas.read', 'terminals.read',
    'activities.read', 'resources.read', 'resources.assign', 'resources.clear', 'resources.health',
    'maintenance.read', 'maintenance.manage',
    'bookings.read', 'bookings.manage', 'sessions.read', 'sessions.manage', 'sessions.override',
    'customers.read', 'customers.manage', 'incidents.report', 'incidents.resolve',
    'till.operate', 'till.reconcile', 'refunds.request',
    'inventory.read', 'inventory.manage', 'transfers.approve',
    'reports.read',
  ],
  scope: { sites: 'ASSIGNED', areas: 'ALL', terminals: 'ALL', activities: 'ALL', resources: 'ALL' },
  activityAccess: [],
  order: 7,
}

/** Main entry counter: registration, booking, ticketing. §3.2, §10.1 US-01..03. */
const CASHIER_RECEPTIONIST: WiqarRoleTemplate = {
  key: 'cashier_receptionist',
  label: 'Cashier-receptionist',
  labelAr: 'موظف الاستقبال والمحاسبة',
  description:
    'Registers visitors, books experiences and takes payment at the main entry counter; issues invoices. Cannot see cumulative revenue.',
  baseRole: 'AGENT',
  permissions: [
    'pos.use', 'bookings.read', 'bookings.manage', 'sessions.read',
    'customers.read', 'customers.manage', 'activities.read',
    'resources.read', 'resources.assign',
    'till.operate', 'refunds.request', 'incidents.report',
  ],
  scope: { sites: 'ASSIGNED', areas: 'ASSIGNED', terminals: 'ASSIGNED', activities: 'ALL', resources: 'BY_ACTIVITY' },
  activityAccess: [],
  order: 8,
}

/**
 * Retail counter in a changing room. §3.2, §10.3 US-09/10.
 *
 * Two of them at each location — male and female section — differing only in which terminal
 * they are posted to. One role, two postings: the difference is a place, not a policy.
 */
const SHOP_CASHIER: WiqarRoleTemplate = {
  key: 'shop_cashier',
  label: 'Shop cashier',
  labelAr: 'أمين صندوق المتجر',
  description:
    'Sells accessories, memorabilia, care products and animal feed at a changing-room counter. Stock decrements on sale. Cannot see cumulative revenue.',
  baseRole: 'AGENT',
  permissions: [
    'pos.use', 'retail.sell', 'bookings.read',
    'customers.read', 'customers.manage',
    'inventory.read',
    'till.operate', 'refunds.request', 'incidents.report',
  ],
  scope: { sites: 'ASSIGNED', areas: 'ASSIGNED', terminals: 'ASSIGNED', activities: 'ASSIGNED', resources: 'NONE' },
  activityAccess: [],
  order: 9,
}

/** Runs riding sessions and assigns horses. No financial access. §3.2, §10.2 US-05. */
const HORSE_TRAINER: WiqarRoleTemplate = {
  key: 'horse_trainer',
  label: 'Horse trainer',
  labelAr: 'مدرب خيل',
  description:
    'Opens, runs and closes riding sessions; assigns horses to bookings; puts an animal into its rest period on closing; raises health concerns. No financial access.',
  baseRole: 'AGENT',
  permissions: [
    'sessions.read', 'sessions.manage',
    'resources.read', 'resources.assign', 'resources.health',
    'bookings.read', 'activities.read', 'customers.read', 'incidents.report',
  ],
  scope: { ...DEFAULT_SCOPE },
  activityAccess: [],
  order: 10,
}

/** Grooming and showering packages, and the consumables they use. §3.2. */
const CARE_RESPONSIBLE: WiqarRoleTemplate = {
  key: 'animal_care_responsible',
  label: 'Animal care responsible',
  labelAr: 'مسؤول العناية بالحيوانات',
  description:
    'Runs grooming and showering packages, tracks the consumables each session uses and asks for replenishment. No financial access.',
  baseRole: 'AGENT',
  permissions: [
    'sessions.read', 'sessions.manage',
    'resources.read', 'resources.assign', 'resources.health',
    'inventory.read', 'bookings.read', 'activities.read', 'incidents.report',
  ],
  scope: { ...DEFAULT_SCOPE },
  activityAccess: [],
  order: 11,
}

/** Camel tours and camel availability. §3.2, §10.2 US-06. */
const CAMEL_RESPONSIBLE: WiqarRoleTemplate = {
  key: 'camel_responsible',
  label: 'Camel responsible',
  labelAr: 'مسؤول الإبل',
  description:
    'Runs camel tours and manages camel availability; raises health or behavioural concerns. No financial access.',
  baseRole: 'AGENT',
  permissions: [
    'sessions.read', 'sessions.manage',
    'resources.read', 'resources.assign', 'resources.health',
    'bookings.read', 'activities.read', 'customers.read', 'incidents.report',
  ],
  scope: { ...DEFAULT_SCOPE },
  activityAccess: [],
  order: 12,
}

/** Welfare, feeding and cleaning; raises concerns. Maintenance requests only. §3.2, §10.2 US-07. */
const ANIMAL_WORKER: WiqarRoleTemplate = {
  key: 'animal_worker',
  label: 'Animal worker',
  labelAr: 'عامل عناية بالحيوانات',
  description:
    'Welfare, feeding and cleaning for the heritage animals; assists trainers; raises health concerns. Access limited to maintenance requests.',
  baseRole: 'AGENT',
  permissions: ['resources.read', 'resources.health', 'maintenance.read', 'maintenance.manage', 'incidents.report'],
  /*
   * No counter, by having none assigned rather than by a special case.
   *
   * §3.2 gives an animal worker no point of sale. 'ASSIGNED' with nothing assigned already
   * means exactly that, so the axis needs no third value — an earlier draft reached for one
   * and had to cast its way past the type to do it.
   */
  scope: { sites: 'ASSIGNED', areas: 'ASSIGNED', terminals: 'ASSIGNED', activities: 'ASSIGNED', resources: 'ASSIGNED' },
  activityAccess: [],
  order: 13,
}

/** Inter-location transfers, confirmed at both ends. §3.2, §10.2 US-08. */
const TRANSPORT_DRIVER: WiqarRoleTemplate = {
  key: 'transport_driver',
  label: 'Transport driver',
  labelAr: 'سائق نقل',
  description:
    'Carries animals and supplies between locations, confirming departure and arrival. Reports to the project manager.',
  baseRole: 'DELIVERY_AGENT',
  permissions: ['transfers.execute', 'resources.read', 'incidents.report'],
  scope: { sites: 'ALL', areas: 'ALL', terminals: 'ASSIGNED', activities: 'ASSIGNED', resources: 'ASSIGNED' },
  activityAccess: [],
  order: 14,
}

/*
 * Cleaners are deliberately absent.
 *
 * §3.2 says "no system access" for them. A job nobody can sign in as should not exist as a
 * login, and creating one "just in case" is how an unused account with real reach appears on
 * an installation nobody is watching.
 */

export const WIQAR_ROLES: WiqarRoleTemplate[] = [
  CEO,
  PROJECT_MANAGER,
  ADMIN_MANAGER,
  CHIEF_ACCOUNTANT,
  IT_MANAGER,
  PURCHASING_AGENT,
  MARKETING_SUPERVISOR,
  SUPERVISOR,
  CASHIER_RECEPTIONIST,
  SHOP_CASHIER,
  HORSE_TRAINER,
  CARE_RESPONSIBLE,
  CAMEL_RESPONSIBLE,
  ANIMAL_WORKER,
  TRANSPORT_DRIVER,
]
