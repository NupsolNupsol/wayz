/**
 * The platform's permission vocabulary.
 *
 * Every permission here names **a thing the software can do**, in words that mean the same
 * for a horse-riding company and a scooter-hire company. Nothing in this file names an
 * activity, an engine, a tenant, or a job title.
 *
 * ## Why this exists
 *
 * Authorisation used to be a map from permission to a list of **role names**:
 *
 * ```ts
 * const PERMISSION_ROLES = { 'accounting.read': ['ACCOUNTANT', 'TENANT_ADMIN'] }
 * ```
 *
 * Compiled in, global, identical for every tenant. That made the role *name* the
 * authorisation model, with two consequences that the client hit directly:
 *
 *   - Every tenant's "Accountant" had exactly the same reach. WIQAR's Chief Accountant
 *     approves payroll and reads inventory valuation; WAYZ's Accountant does neither. There
 *     was nowhere to say so.
 *   - Business rules leaked into platform code. `LAGOON_ONLY = ['CHIEF_CAPTAIN']` is a fact
 *     about WAYZ's boats sitting in a file every tenant is governed by.
 *
 * So permissions are primitives, and **which primitives a job holds is a tenant's own
 * decision** — recorded in a role definition in that tenant's database. Two tenants may both
 * have a role called "Accountant" and mean entirely different things by it.
 */

export interface PermissionDef {
  key: string
  label: string
  /** What it is for, in one line, so a tenant admin composing a role can choose sensibly. */
  blurb: string
  group: PermissionGroup
}

export const PERMISSION_GROUPS = [
  'PEOPLE',
  'OPERATIONS',
  'ACTIVITIES',
  'RESOURCES',
  'ESTATE',
  'MONEY',
  'STOCK',
  'INSIGHT',
  'ADMIN',
] as const
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number]

/**
 * The whole vocabulary.
 *
 * Read/manage pairs throughout, because "can see it" and "can change it" are almost always
 * different jobs — the PDF's marketing supervisor reads visitor data and writes none of it,
 * and the purchasing agent raises orders but may not approve them.
 */
export const PERMISSIONS: PermissionDef[] = [
  /* ---------------------------------------------------------------- people */
  { key: 'users.read', label: 'See user accounts', blurb: 'View who has an account.', group: 'PEOPLE' },
  { key: 'users.manage', label: 'Manage user accounts', blurb: 'Create, edit and deactivate accounts.', group: 'PEOPLE' },
  { key: 'employees.read', label: 'See employees', blurb: 'View the staff list and their postings.', group: 'PEOPLE' },
  { key: 'employees.manage', label: 'Manage employees', blurb: 'Hire, post and offboard staff.', group: 'PEOPLE' },
  { key: 'roles.read', label: 'See roles', blurb: 'View how jobs are defined.', group: 'PEOPLE' },
  { key: 'roles.manage', label: 'Manage roles', blurb: 'Define jobs and what they may do.', group: 'PEOPLE' },
  { key: 'attendance.read', label: 'See attendance', blurb: 'View hours and presence.', group: 'PEOPLE' },
  { key: 'attendance.manage', label: 'Manage attendance', blurb: 'Correct hours and record absence.', group: 'PEOPLE' },
  { key: 'leave.request', label: 'Request leave', blurb: 'Ask for time off.', group: 'PEOPLE' },
  { key: 'leave.approve', label: 'Approve leave', blurb: 'Decide on time-off requests.', group: 'PEOPLE' },
  { key: 'payroll.read', label: 'See payroll', blurb: 'View pay runs.', group: 'PEOPLE' },
  { key: 'payroll.approve', label: 'Approve payroll', blurb: 'Release a pay run.', group: 'PEOPLE' },

  /* ------------------------------------------------------------ operations */
  { key: 'pos.use', label: 'Serve customers', blurb: 'Take bookings and sales at a counter.', group: 'OPERATIONS' },
  { key: 'bookings.read', label: 'See bookings', blurb: 'View what has been sold.', group: 'OPERATIONS' },
  { key: 'bookings.manage', label: 'Manage bookings', blurb: 'Amend and cancel bookings.', group: 'OPERATIONS' },
  { key: 'sessions.read', label: 'See sessions', blurb: 'View what is running now.', group: 'OPERATIONS' },
  { key: 'sessions.manage', label: 'Run sessions', blurb: 'Start, progress and finish a session.', group: 'OPERATIONS' },
  { key: 'sessions.override', label: 'Override a session', blurb: 'Break a capacity or slot rule, with a reason.', group: 'OPERATIONS' },
  { key: 'customers.read', label: 'See customers', blurb: 'Look up a visitor.', group: 'OPERATIONS' },
  { key: 'customers.manage', label: 'Manage customers', blurb: 'Register and correct visitor records.', group: 'OPERATIONS' },
  { key: 'incidents.report', label: 'Report incidents', blurb: 'Raise something that went wrong.', group: 'OPERATIONS' },
  { key: 'incidents.resolve', label: 'Resolve incidents', blurb: 'Close an incident.', group: 'OPERATIONS' },
  { key: 'transfers.execute', label: 'Carry transfers', blurb: 'Move things between locations and confirm it.', group: 'OPERATIONS' },
  { key: 'transfers.approve', label: 'Approve transfers', blurb: 'Authorise a move between locations.', group: 'OPERATIONS' },

  /* ------------------------------------------------------------ activities */
  { key: 'activities.read', label: 'See activities', blurb: 'View what this company offers.', group: 'ACTIVITIES' },
  { key: 'activities.manage', label: 'Design activities', blurb: 'Build an activity: form, rules, workflow, price.', group: 'ACTIVITIES' },
  { key: 'activities.publish', label: 'Publish activities', blurb: 'Make an activity live, or archive it.', group: 'ACTIVITIES' },

  /* ------------------------------------------------------------- resources */
  { key: 'resources.read', label: 'See resources', blurb: 'View the things this company works with.', group: 'RESOURCES' },
  { key: 'resources.manage', label: 'Manage resources', blurb: 'Add, retire and edit resources.', group: 'RESOURCES' },
  { key: 'resources.assign', label: 'Assign resources', blurb: 'Put a resource to work on a session.', group: 'RESOURCES' },
  { key: 'resources.health', label: 'Report a resource concern', blurb: 'Flag something as unfit for use.', group: 'RESOURCES' },
  { key: 'resources.clear', label: 'Clear a resource', blurb: 'Return something to service after a concern.', group: 'RESOURCES' },
  { key: 'maintenance.read', label: 'See maintenance', blurb: 'View upkeep and its history.', group: 'RESOURCES' },
  { key: 'maintenance.manage', label: 'Manage maintenance', blurb: 'Schedule and record upkeep.', group: 'RESOURCES' },

  /* ---------------------------------------------------------------- estate */
  { key: 'sites.read', label: 'See locations', blurb: 'View where this company operates.', group: 'ESTATE' },
  { key: 'sites.manage', label: 'Manage locations', blurb: 'Add and edit locations.', group: 'ESTATE' },
  { key: 'areas.read', label: 'See areas', blurb: 'View the areas within a location.', group: 'ESTATE' },
  { key: 'areas.manage', label: 'Manage areas', blurb: 'Add and edit operational areas.', group: 'ESTATE' },
  { key: 'terminals.read', label: 'See counters', blurb: 'View the points of sale.', group: 'ESTATE' },
  { key: 'terminals.manage', label: 'Manage counters', blurb: 'Add and configure points of sale.', group: 'ESTATE' },

  /* ----------------------------------------------------------------- money */
  { key: 'till.operate', label: 'Operate a till', blurb: 'Open, hold and close a cash drawer.', group: 'MONEY' },
  { key: 'till.reconcile', label: 'Reconcile a till', blurb: 'Settle a drawer against what it should hold.', group: 'MONEY' },
  { key: 'finance.read', label: 'See finances', blurb: 'View revenue, costs and reconciliation.', group: 'MONEY' },
  { key: 'finance.write', label: 'Record finances', blurb: 'Enter expenses and manual sales.', group: 'MONEY' },
  { key: 'finance.approve', label: 'Approve finances', blurb: 'Authorise what others recorded.', group: 'MONEY' },
  { key: 'finance.reconcile', label: 'Reconcile finances', blurb: 'Match takings to the bank.', group: 'MONEY' },
  { key: 'refunds.request', label: 'Request a refund', blurb: 'Ask for money to go back.', group: 'MONEY' },
  { key: 'refunds.approve', label: 'Approve a refund', blurb: 'Release money back to a customer.', group: 'MONEY' },
  { key: 'pricing.manage', label: 'Set prices', blurb: 'Change what things cost.', group: 'MONEY' },
  { key: 'discounts.approve', label: 'Approve discounts', blurb: 'Authorise a reduction.', group: 'MONEY' },

  /* ----------------------------------------------------------------- stock */
  { key: 'inventory.read', label: 'See stock', blurb: 'View what is held.', group: 'STOCK' },
  { key: 'inventory.manage', label: 'Manage stock', blurb: 'Adjust and count stock.', group: 'STOCK' },
  { key: 'inventory.transfer', label: 'Move stock', blurb: 'Send stock between locations.', group: 'STOCK' },
  { key: 'inventory.valuation', label: 'See stock value', blurb: 'View what the stock is worth.', group: 'STOCK' },
  { key: 'procurement.read', label: 'See purchasing', blurb: 'View purchase orders.', group: 'STOCK' },
  { key: 'procurement.create', label: 'Raise a purchase order', blurb: 'Order from a supplier.', group: 'STOCK' },
  { key: 'procurement.approve', label: 'Approve a purchase order', blurb: 'Authorise spending.', group: 'STOCK' },
  { key: 'procurement.receive', label: 'Receive goods', blurb: 'Book a delivery in.', group: 'STOCK' },
  { key: 'retail.sell', label: 'Sell retail', blurb: 'Serve a shop counter.', group: 'STOCK' },

  /* --------------------------------------------------------------- insight */
  { key: 'reports.read', label: 'See reports', blurb: 'View reporting for what this role can see.', group: 'INSIGHT' },
  { key: 'reports.financial', label: 'See financial reports', blurb: 'View money reporting.', group: 'INSIGHT' },
  { key: 'reports.export', label: 'Export reports', blurb: 'Take reporting out of the system.', group: 'INSIGHT' },
  { key: 'audit.read', label: 'See the audit trail', blurb: 'View who did what.', group: 'INSIGHT' },

  /* ----------------------------------------------------------------- admin */
  { key: 'tenant.configure', label: 'Configure the company', blurb: 'Identity, branding, rules and settings.', group: 'ADMIN' },
  { key: 'tenant.administer', label: 'Administer everything', blurb: 'Full reach over this company.', group: 'ADMIN' },
]

export const PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key)
const KNOWN = new Set(PERMISSION_KEYS)

export const isPermission = (key: string): boolean => KNOWN.has(key)

/** Drops anything that is not a permission this platform knows. */
export function sanitisePermissions(keys: string[] | undefined | null): string[] {
  return [...new Set(keys ?? [])].filter(isPermission).sort()
}

/**
 * How far a role can see, on each axis it can be limited along.
 *
 * `ALL` means everywhere in the tenant. `ASSIGNED` means only what this person has been
 * posted to. `BY_ACTIVITY` — only on the resource axis — means the resources the activities
 * they work are allowed to use, which is the rule a horse trainer needs: the horses eligible
 * for their ride at their location, and no other animal anywhere.
 */
export const SCOPE_MODES = ['ALL', 'ASSIGNED', 'BY_ACTIVITY', 'NONE'] as const
export type ScopeMode = (typeof SCOPE_MODES)[number]

export interface RoleScope {
  /** Which locations. */
  sites: Extract<ScopeMode, 'ALL' | 'ASSIGNED'>
  /** Which operational areas within them. */
  areas: Extract<ScopeMode, 'ALL' | 'ASSIGNED'>
  /** Which counters. */
  terminals: Extract<ScopeMode, 'ALL' | 'ASSIGNED'>
  /** Which activities. */
  activities: Extract<ScopeMode, 'ALL' | 'ASSIGNED'>
  /** Which resources — and this is the one that matters most. */
  resources: ScopeMode
}

export const DEFAULT_SCOPE: RoleScope = {
  sites: 'ASSIGNED',
  areas: 'ASSIGNED',
  terminals: 'ASSIGNED',
  activities: 'ASSIGNED',
  resources: 'BY_ACTIVITY',
}

/** Everything, for the job that owns the company. */
export const TENANT_WIDE_SCOPE: RoleScope = {
  sites: 'ALL',
  areas: 'ALL',
  terminals: 'ALL',
  activities: 'ALL',
  resources: 'ALL',
}
