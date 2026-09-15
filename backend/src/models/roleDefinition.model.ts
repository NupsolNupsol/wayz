import { Schema, model } from 'mongoose'

import { DEFAULT_SCOPE, type RoleScope } from '../platform/permissions.js'
import type { Role } from '../domain/types.js'

/**
 * A job, as a company defines it.
 *
 * This is the correction to the deepest wrong assumption in the product: that a **role name**
 * is the authorisation model. It used to be. Permissions were a compiled-in map from a
 * permission to a list of role names, identical for every tenant, so every company's
 * "Accountant" had precisely the same reach — and there was nowhere to record that WIQAR's
 * Chief Accountant approves payroll and reads inventory valuation while WAYZ's Accountant
 * does neither.
 *
 * Worse, business rules leaked in beside them: `LAGOON_ONLY = ['CHIEF_CAPTAIN']` is a fact
 * about WAYZ's boats, sitting in a file that governs every tenant on the platform.
 *
 * So a job is now a **record a tenant owns**, in that tenant's own database. Two tenants may
 * both have a role called "Accountant" and mean entirely different things by it, and neither
 * definition is visible to the other.
 *
 * ## What is shared and what is not
 *
 * | Shared (platform machinery) | Not shared (tenant business meaning) |
 * |---|---|
 * | the permission vocabulary | which permissions a job holds |
 * | the scope axes (site, area, terminal, activity, resource) | how far a job is scoped |
 * | the base role primitive | what the job is called and what it means |
 * | the hierarchy Site → Area → Terminal | what those are called and what happens in them |
 *
 * ## Why `baseRole` still exists
 *
 * The platform has machinery that needs to know the *shape* of a job rather than its meaning:
 * a signed token carries one, route guards check one, and the workflow engine asks whether an
 * actor is a desk worker or a floor lead. That is genuinely platform-level, so it stays — but
 * it carries no business meaning of its own. `AGENT` means "works a counter", not "sells bag
 * storage"; a WIQAR cashier-receptionist and a WAYZ Shop & Drop agent are both `AGENT` and
 * have nothing else in common.
 *
 * Everything a person may actually *do* comes from this record, never from that primitive.
 */

export interface RoleDefinitionDoc {
  _id: string
  tenantId: string
  /** Stable within the tenant. Employees reference a job by this. */
  key: string
  label: string
  labelAr: string
  description: string
  /**
   * The shape of the job, for the platform machinery that needs one.
   *
   * Not a source of permissions. See the note above.
   */
  baseRole: Role
  /** The generic primitives this job composes. See `platform/permissions.ts`. */
  permissions: string[]
  /** How far it can see, on each axis. */
  scope: RoleScope
  /**
   * Which activities this job may be assigned to work.
   *
   * Empty means any activity the tenant publishes — which is what a supervisor or a manager
   * usually wants. A horse trainer names the rides they run.
   */
  activityAccess: string[]
  /**
   * Which of the platform's built-in engines this job may work, for a tenant that runs them.
   *
   * Deliberately a separate list from `activityAccess`. An engine is a specialised, developer-
   * built domain module with behaviour of its own; an activity is tenant configuration. A
   * tenant that invents an activity called `MOBILITY` must not inherit the mobility engine,
   * and keeping the two in one list is exactly how that would happen.
   */
  engineAccess: string[]
  /** A job the platform created and the tenant should not delete — the administrator. */
  system: boolean
  active: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

const scopeSchema = new Schema<RoleScope>(
  {
    sites: { type: String, enum: ['ALL', 'ASSIGNED'], default: 'ASSIGNED' },
    areas: { type: String, enum: ['ALL', 'ASSIGNED'], default: 'ASSIGNED' },
    terminals: { type: String, enum: ['ALL', 'ASSIGNED'], default: 'ASSIGNED' },
    activities: { type: String, enum: ['ALL', 'ASSIGNED'], default: 'ASSIGNED' },
    resources: { type: String, enum: ['ALL', 'ASSIGNED', 'BY_ACTIVITY', 'NONE'], default: 'BY_ACTIVITY' },
  },
  { _id: false },
)

const roleDefinitionSchema = new Schema<RoleDefinitionDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    labelAr: { type: String, default: '' },
    description: { type: String, default: '' },
    baseRole: { type: String, required: true },
    permissions: { type: [String], default: [] },
    scope: { type: scopeSchema, default: () => ({ ...DEFAULT_SCOPE }) },
    activityAccess: { type: [String], default: [] },
    engineAccess: { type: [String], default: [] },
    system: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false, timestamps: true },
)

// One key per tenant: an employee resolves their job by key, so two would be ambiguous.
roleDefinitionSchema.index({ tenantId: 1, key: 1 }, { unique: true })

export const RoleDefinition = model<RoleDefinitionDoc>('RoleDefinition', roleDefinitionSchema, 'roledefinitions')

export { roleDefinitionSchema }
