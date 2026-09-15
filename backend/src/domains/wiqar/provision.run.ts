import { connectDB, disconnectDB } from '../../config/db.js'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { bootstrapPlatform } from '../../platform/bootstrap.js'
import { closeAllConnections, platformDb } from '../../platform/connections.js'
import { createTenant } from '../../platform/provisioning.service.js'
import { runInTenant } from '../../platform/tenantContext.js'
import { seedTenantDemoStaff } from '../../seed/tenantStaff.seed.js'
import { provisionWiqarDomain } from './provision.js'
import type { TenantRegistryDoc } from '../../platform/registry.model.js'

/**
 * `npm run provision:wiqar` — WIQAR, from nothing.
 *
 * Two stages, deliberately separate and in this order:
 *
 *   1. **Generic provisioning.** `createTenant` — the same call the Super Admin's *Create &
 *      provision* button makes. A database, indexes, a tenant record, one administrator job,
 *      one administrator. Nothing of anybody's business.
 *   2. **WIQAR's domain module.** Its locations, areas, counters, animals, activities, roles
 *      and catalogue, from its own requirements.
 *
 * Keeping them apart is the architecture, not a tidiness preference: stage one is what every
 * future tenant gets, and stage two is what makes this one WIQAR. Tenant number three runs
 * stage one and then its own stage two, or none at all.
 */

const WIQAR = {
  slug: 'wiqar',
  name: 'WIQAR',
  nameAr: 'وقار',
  branding: {
    primaryColor: '#6b4423',
    secondaryColor: '#8c6239',
    accentColor: '#c9a227',
    logoText: 'WQ',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  /*
   * What this business does.
   *
   * No STORAGE, no RENTALS, no BOATS, no DELIVERY: WIQAR runs an equestrian and animal hub,
   * and the jobs and screens those capabilities bring have no meaning here.
   */
  capabilities: ['POS', 'ACTIVITIES', 'ANIMALS', 'INVENTORY', 'RETAIL', 'HR', 'FINANCE'],
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

async function run() {
  if (!env.DEMO_LOGINS) {
    console.error('DEMO_LOGINS is false. This provisions a demonstration tenant and will not run here.')
    process.exitCode = 1
    return
  }

  console.log('\nLockerFlow · provisioning WIQAR')
  console.log('='.repeat(72))

  await connectDB(env.MONGODB_URI)
  await bootstrapPlatform()

  const { TenantRegistry } = platformDb()
  const existing = await TenantRegistry.findOne({ slug: WIQAR.slug }).lean<TenantRegistryDoc>()

  if (existing) {
    console.error(`\nWIQAR already exists on ${existing.dbName}.`)
    console.error('Reset it first if you mean to rebuild it:  npm run reset:tenant -- wiqar\n')
    process.exitCode = 1
    return
  }

  /* ---- stage one: the generic path every tenant takes ---- */
  console.log('\n1 · Generic provisioning')
  console.log('-'.repeat(72))

  const tenant = await createTenant({
    slug: WIQAR.slug,
    name: WIQAR.name,
    nameAr: WIQAR.nameAr,
    invoice: WIQAR.invoice,
    branding: WIQAR.branding,
    capabilities: WIQAR.capabilities,
    /*
     * No profile list.
     *
     * `enabledProfiles` is the platform's old job vocabulary. WIQAR's jobs are its own, and
     * naming any of the platform's here would be the inheritance this refactor removes.
     */
    enabledProfiles: [],
    admin: WIQAR.admin,
    createdBy: 'wiqar-provisioning',
  })

  console.log(`  database        ${tenant.dbName}`)
  console.log(`  lifecycle       ${tenant.lifecycle}`)
  console.log(`  capabilities    ${(tenant.capabilities ?? []).join(', ')}`)

  const generic = await runInTenant(tenant._id, async (ctx) => {
    const { RoleDefinition, User, Site, Station, Kiosk, ActivityDefinition } = ctx.models
    return {
      roles: await RoleDefinition.countDocuments({}),
      users: await User.countDocuments({}),
      sites: await Site.countDocuments({}),
      areas: await Station.countDocuments({}),
      terminals: await Kiosk.countDocuments({}),
      activities: await ActivityDefinition.countDocuments({}),
    }
  })

  console.log('')
  console.log('  What generic provisioning gave it — and nothing else:')
  console.log(`    jobs          ${generic.roles}   (the administrator, and only that)`)
  console.log(`    people        ${generic.users}`)
  console.log(`    locations     ${generic.sites}`)
  console.log(`    areas         ${generic.areas}`)
  console.log(`    counters      ${generic.terminals}`)
  console.log(`    activities    ${generic.activities}`)

  /* ---- stage two: this particular company's business ---- */
  console.log('\n2 · WIQAR domain configuration')
  console.log('-'.repeat(72))

  const domain = await provisionWiqarDomain(tenant._id)

  console.log(`  jobs            ${domain.roles}`)
  console.log(`  locations       ${domain.sites} site · ${domain.areas} areas`)
  console.log(`  counters        ${domain.terminals}`)
  console.log(`  animal kinds    ${domain.resourceKinds}`)
  console.log(`  animals         ${domain.resources}`)
  console.log(`  activities      ${domain.activities}`)
  console.log(`  retail products ${domain.products}`)

  /* ---- and somebody to sign in as, on a demonstration box ---- */
  const staff = await seedTenantDemoStaff(WIQAR.slug)
  console.log(`\n3 · Demonstration accounts: ${staff.filter((s) => s.created).length} created`)

  console.log('')
  console.log(`Sign in at /t/${WIQAR.slug}/login`)
  console.log('')
}

run()
  .catch((err) => {
    logger.error('WIQAR provisioning failed', { err: err instanceof Error ? err.message : String(err) })
    console.error('\nFAILED:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeAllConnections().catch(() => undefined)
    await disconnectDB().catch(() => undefined)
  })
