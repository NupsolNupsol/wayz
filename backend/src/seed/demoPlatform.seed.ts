import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { platformDb } from '../platform/connections.js'
import { createTenant, provisionTenant } from '../platform/provisioning.service.js'
import { seedTenantDemoStaff } from './tenantStaff.seed.js'
import type { TenantRegistryDoc } from '../platform/registry.model.js'

/**
 * Everything a demonstration deployment needs to exist before anybody signs in.
 *
 * One command, run once on a fresh machine: the platform administrator, the two demonstration
 * companies, their identities, and a set of accounts to click on each. It replaces the
 * sequence of half-remembered steps that used to be needed — seed, provision through the UI,
 * seed the staff, fix the branding by hand — any of which could be forgotten, and one of which
 * usually was.
 *
 * **Idempotent throughout.** A tenant that exists is reconciled, not recreated: its identity is
 * brought back to what this file says it should be, and its data is left completely alone.
 * That is what makes it safe to run on every deploy of a demonstration box.
 *
 * It refuses to run unless the deployment has said it is a demonstration. A real installation
 * has no business being given two example companies.
 */

/**
 * WAYZ's identity — the one it has always had.
 *
 * Teal and deep teal with an amber accent. Recorded here because the registry is what the
 * product actually serves, and a registry row is editable from a screen and by a test: WAYZ's
 * colours had at one point been changed to a neon green nobody chose, and there was nothing
 * to put them back from. This file is that thing.
 */
const WAYZ_IDENTITY = {
  name: 'WAYZ',
  branding: {
    primaryColor: '#14b8a6',
    secondaryColor: '#0f766e',
    accentColor: '#f5a623',
    logoText: 'WZ',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  capabilities: ['POS', 'STORAGE', 'RENTALS', 'BOATS', 'DELIVERY', 'HR', 'FINANCE', 'ACTIVITIES'],
}

/** WIQAR's — desert sand and date-palm, so the two are never mistaken on a shared screen. */
const WIQAR_IDENTITY = {
  name: 'WIQAR',
  nameAr: 'وقار',
  branding: {
    primaryColor: '#6b4423',
    secondaryColor: '#8c6239',
    accentColor: '#c9a227',
    logoText: 'WQ',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  capabilities: ['POS', 'ACTIVITIES', 'ANIMALS', 'INVENTORY', 'RETAIL', 'HR', 'FINANCE'],
  enabledProfiles: [
    'TENANT_ADMIN',
    'PROJECT_MANAGER',
    'MANAGER',
    'SUPERVISOR',
    'COUNTER_AGENT',
    'ACTIVITY_AGENT',
    'ACCOUNTANT',
    'HR',
  ],
  invoice: {
    legalName: 'WIQAR Experiential Hospitality Co.',
    legalNameAr: 'شركة وقار للضيافة التجريبية',
    crNumber: '4030555123',
    vatNumber: '310555123400003',
    address: 'Ala Khutah Season, Jeddah Governorate',
    addressAr: 'موسم علا خطاه، محافظة جدة',
    phone: '0126000000',
    email: 'ops@wiqar.example',
  },
  admin: {
    email: 'admin.wiqar@lockerflow.demo',
    fullName: 'WIQAR Administrator',
    password: process.env.WIQAR_ADMIN_PASSWORD ?? 'Wiqar@1234',
  },
}

export interface PlatformSeedReport {
  admins: number
  tenants: { slug: string; action: 'created' | 'reconciled'; staff: number }[]
}

/**
 * Brings a registered tenant's identity back to what this file says it is.
 *
 * Only the registry row — the tenant's own data is never touched. Provisioning state and
 * lifecycle are left alone too, so reconciling a suspended tenant does not quietly restore it.
 */
async function reconcileIdentity(
  slug: string,
  identity: { name: string; nameAr?: string; branding: Record<string, string>; capabilities: string[]; enabledProfiles?: string[]; invoice?: Record<string, string> },
): Promise<void> {
  const { TenantRegistry } = platformDb()
  const row = await TenantRegistry.findOne({ slug })
  if (!row) return

  row.name = identity.name
  if (identity.nameAr) (row as TenantRegistryDoc & { nameAr?: string }).nameAr = identity.nameAr
  row.branding = { ...row.branding, ...identity.branding }
  row.capabilities = identity.capabilities
  if (identity.enabledProfiles) row.enabledProfiles = identity.enabledProfiles
  if (identity.invoice) row.invoice = { ...row.invoice, ...identity.invoice }

  await row.save()
}

export async function seedDemoPlatform(): Promise<PlatformSeedReport> {
  const { TenantRegistry, PlatformAdmin } = platformDb()
  const report: PlatformSeedReport = { admins: 0, tenants: [] }

  report.admins = await PlatformAdmin.countDocuments({})

  /*
   * WAYZ is registered by `bootstrapPlatform`, which adopts the original single-tenant
   * database. Its identity is reconciled here rather than created, so this never risks
   * standing between an existing installation and its own data.
   */
  const wayz = await TenantRegistry.findOne({ slug: 'wayz' }).lean<TenantRegistryDoc>()
  if (wayz) {
    await reconcileIdentity('wayz', WAYZ_IDENTITY)
    report.tenants.push({ slug: 'wayz', action: 'reconciled', staff: 0 })
  }

  /* WIQAR is a demonstration tenant, created here if it is not there. */
  const wiqar = await TenantRegistry.findOne({ slug: 'wiqar' }).lean<TenantRegistryDoc>()

  if (!wiqar) {
    await createTenant({
      slug: 'wiqar',
      name: WIQAR_IDENTITY.name,
      invoice: WIQAR_IDENTITY.invoice,
      branding: WIQAR_IDENTITY.branding,
      capabilities: WIQAR_IDENTITY.capabilities,
      enabledProfiles: WIQAR_IDENTITY.enabledProfiles,
      admin: WIQAR_IDENTITY.admin,
      createdBy: 'demo-seed',
    })
    report.tenants.push({ slug: 'wiqar', action: 'created', staff: 0 })
  } else {
    await reconcileIdentity('wiqar', WIQAR_IDENTITY)
    /*
     * Resume provisioning, which also reconciles the first administrator's recorded
     * credential — the step that lets their sign-in page advertise an account that works.
     */
    await provisionTenant(wiqar._id, WIQAR_IDENTITY.admin)
    report.tenants.push({ slug: 'wiqar', action: 'reconciled', staff: 0 })
  }

  /*
   * One demonstration account per job — but only where a tenant has none of its own.
   *
   * WAYZ seeds eighteen accounts with real names, desks and reporting lines. Adding a generic
   * "WAYZ counter agent" beside them would clutter a staff list somebody spent care on, to
   * solve a problem WAYZ does not have. This exists for a tenant provisioned with exactly one
   * administrator, which is every tenant created through the control plane.
   */
  const { User } = await import('../models/index.js')
  const { runInTenant } = await import('../platform/tenantContext.js')

  for (const entry of report.tenants) {
    const registry = await TenantRegistry.findOne({ slug: entry.slug }).lean<TenantRegistryDoc>()
    if (!registry) continue

    const alreadyStaffed = await runInTenant(registry._id, async () =>
      User.countDocuments({ email: /@lockerflow\.demo$/, demoCredential: { $ne: null } }),
    )
    if (alreadyStaffed > 1) continue

    const accounts = await seedTenantDemoStaff(entry.slug)
    entry.staff = accounts.filter((a) => a.created).length
  }

  logger.info('Demo platform seeded', {
    admins: report.admins,
    tenants: report.tenants.map((t) => `${t.slug}:${t.action}`),
  })

  return report
}

/** The guard, so this can never be pointed at a real installation by accident. */
export function assertDemonstrationDeployment(): void {
  if (!env.DEMO_LOGINS) {
    throw new Error(
      'DEMO_LOGINS is false. Refusing to seed demonstration companies into a deployment that has said it is not a demonstration.',
    )
  }
}
