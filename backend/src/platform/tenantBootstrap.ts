import type { TenantContext } from './tenantContext.js'
import { administratorTemplate, createRoleDefinition } from '../services/roleDefinition.service.js'

/**
 * What a brand-new tenant is given, and nothing more.
 *
 * The rule this file enforces is the one the whole refactor turns on:
 *
 * > **A new tenant inherits the platform's machinery. It inherits nobody's business.**
 *
 * Before this, provisioning created a tenant record and a first administrator, and everything
 * else a tenant needed came from generic code that had WAYZ's business baked into it — three
 * activities in every picker, nine role names with WAYZ's permissions attached, asset access
 * that assumed one of three engines. A company that runs horse tours started life being
 * offered a lagoon.
 *
 * So this gives a new tenant exactly four things:
 *
 *   1. Its database and indexes — the machinery.
 *   2. Its own tenant record — identity, currency, invoice details.
 *   3. **One** job: an administrator, who will define the rest.
 *   4. Its first person, holding that job.
 *
 * And deliberately not:
 *
 *   - any operational job. WAYZ's nine roles are WAYZ's answer to WAYZ's business.
 *   - any activity. What a company sells is what it sells.
 *   - any site, area or counter. Where it operates is its own.
 *   - any asset kind, product or price.
 *
 * A tenant's domain configuration is then established from its own requirements — through the
 * screens, through its own domain module if it has one, or by its administrator. Tenant number
 * three inherits neither WAYZ's business nor WIQAR's.
 */

export interface BootstrapReport {
  roles: string[]
}

/**
 * Seeds the generic starting point into a freshly provisioned tenant.
 *
 * Idempotent: a job that already exists is left exactly as it is, including any edits the
 * tenant has made to it. Re-running provisioning must never quietly undo somebody's work.
 */
export async function bootstrapTenantDefaults(ctx: TenantContext): Promise<BootstrapReport> {
  const { RoleDefinition } = ctx.models
  const report: BootstrapReport = { roles: [] }

  const admin = administratorTemplate()
  const existing = await RoleDefinition.findOne({ tenantId: ctx.tenantId, key: admin.key }).lean()

  if (!existing) {
    await createRoleDefinition(ctx.tenantId, admin, true)
    report.roles.push(admin.key)
  }

  return report
}
