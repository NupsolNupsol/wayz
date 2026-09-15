import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { platformDb } from '../platform/connections.js'
import { profilesAvailableFor } from '../platform/capabilities.js'
import { runInTenant } from '../platform/tenantContext.js'
import { hashPassword } from '../models/user.model.js'
import type { RoleDefinitionDoc } from '../models/index.js'
import type { TenantRegistryDoc as RegistryDoc } from '../platform/registry.model.js'

/**
 * One demonstration account per job a tenant can actually staff.
 *
 * Provisioning deliberately creates only a tenant's first administrator, because who else a
 * company employs is its own business. That is right for a real deployment and useless for a
 * demonstration: a newly provisioned tenant's sign-in page offers exactly one account.
 *
 * ## Where the jobs come from
 *
 * **The tenant's own role definitions**, when it has any. That is the whole point of the
 * refactor: a company that has defined a horse trainer and a camel responsible gets accounts
 * for those, not for the platform's idea of what jobs exist.
 *
 * A tenant that has not defined its jobs yet — WAYZ, whose eighteen people predate role
 * definitions — falls back to the capability-driven profile list, which is what it has always
 * used. Neither path names a tenant.
 *
 * Idempotent: an account that already exists is left exactly as it is, including its password.
 */

/**
 * The password seeded demonstration accounts are given.
 *
 * Not a secret and not pretending to be one: it exists only on deployments that have declared
 * themselves demonstrations, and every account using it is already printed on the sign-in
 * page. Configurable so nothing about a real deployment depends on a literal here, and
 * recorded per account so the sign-in page reads back what was actually set.
 */
const DEMO_PASSWORD = process.env.TENANT_DEMO_PASSWORD ?? 'Demo@12345'

export interface SeededStaffAccount {
  profile: string
  email: string
  role: string
  created: boolean
}

/** `Horse trainer` → `horse.trainer.wiqar@lockerflow.demo` */
const emailFor = (key: string, slug: string) => `${key.toLowerCase().replace(/_/g, '.')}.${slug}@lockerflow.demo`

export async function seedTenantDemoStaff(slug: string): Promise<SeededStaffAccount[]> {
  const { TenantRegistry } = platformDb()
  const registry = await TenantRegistry.findOne({ slug: slug.toLowerCase() }).lean<RegistryDoc>()
  if (!registry) throw new Error(`No tenant registered under the handle "${slug}".`)

  return runInTenant(registry._id, async (ctx) => {
    const { User, Kiosk, Station, RoleDefinition } = ctx.models

    const [defined, kiosks, stations, activities] = await Promise.all([
      RoleDefinition.find({ tenantId: registry._id, active: true }).sort({ order: 1 }).lean<RoleDefinitionDoc[]>(),
      Kiosk.find({}, { _id: 1, name: 1, stationId: 1, activityKeys: 1 }).sort({ _id: 1 }).lean(),
      Station.find({}, { _id: 1, siteId: 1, activityKeys: 1 }).sort({ _id: 1 }).lean(),
      ctx.models.ActivityDefinition.find(
        { status: 'PUBLISHED', currentRevision: { $gt: 0 } },
        { key: 1, revisions: 1, currentRevision: 1 },
      ).lean(),
    ])

    /*
     * Where a job actually works.
     *
     * Round-robin over every counter posted a horse trainer to a shop till, which is nonsense
     * and looks it. A job is posted to a place one of its own activities runs in: the trainer
     * to an equestrian area, the shop cashier to a shop counter, and anybody whose activities
     * name no place to the first area, which is the honest answer for a job with no home.
     */
    const areasOfActivity = new Map<string, string[]>()
    for (const a of activities) {
      const live = a.revisions.find((r: { revision: number }) => r.revision === a.currentRevision)
      if (live) areasOfActivity.set(a.key as string, (live.areaIds ?? []) as string[])
    }

    const placeFor = (roleKey: string | null) => {
      const worked = roleKey
        ? activities.filter((a) => {
            const live = a.revisions.find((r: { revision: number }) => r.revision === a.currentRevision)
            const operators = (live?.operatorRoleKeys ?? []) as string[]
            return operators.includes(roleKey)
          })
        : []

      const areaIds = new Set(worked.flatMap((a) => areasOfActivity.get(a.key as string) ?? []))
      const area = stations.find((s) => areaIds.has(String(s._id))) ?? stations[0] ?? null
      const desk = area
        ? (kiosks.find((k) => String(k.stationId) === String(area._id)) ?? kiosks[0] ?? null)
        : (kiosks[0] ?? null)

      /*
       * The activities this person is actually assigned.
       *
       * Not decoration. A person's visible resources are the resources of the activities they
       * work, so somebody hired with none sees nothing — correct, and useless as a
       * demonstration account. Hiring through the employee form assigns them; seeding has to
       * do the same thing, and for the same reason.
       */
      return { area, desk, activityKeys: worked.map((a) => a.key as string) }
    }

    /*
     * The tenant's own jobs, or the platform's profile list for one that has none yet.
     *
     * Reduced to the same shape either way, so the loop below does not care which it got.
     */
    const jobs: { key: string; label: string; baseRole: string; needsDesk: boolean }[] = defined.length
      ? defined.map((r) => ({
          key: r.key,
          label: r.label,
          baseRole: r.baseRole,
          needsDesk: r.scope.terminals === 'ASSIGNED' && r.scope.resources !== 'NONE',
        }))
      : profilesAvailableFor(registry.capabilities ?? [])
          .filter((p) => (registry.enabledProfiles?.length ? registry.enabledProfiles.includes(p.key) : true))
          .map((p) => ({ key: p.key, label: p.label, baseRole: p.role, needsDesk: !!p.deskScoped }))

    const results: SeededStaffAccount[] = []

    for (const job of jobs) {
      const email = emailFor(job.key, registry.slug)
      if (await User.findOne({ email }).lean()) {
        results.push({ profile: job.key, email, role: job.baseRole, created: false })
        continue
      }

      /*
       * A job that answers for a counter needs one, and a tenant that has not built its estate
       * yet has none. The account is still created — signing in and being told there is nowhere
       * to work is a clearer first experience than not being able to sign in at all.
       */
      const { area, desk: candidate, activityKeys } = placeFor(defined.length ? job.key : null)
      const desk = job.needsDesk ? candidate : null
      const station = desk ? stations.find((s) => String(s._id) === String(desk.stationId)) : area

      await User.create({
        _id: `usr_${job.key.toLowerCase()}_${registry.slug}`,
        tenantId: registry._id,
        email,
        fullName: `${registry.name} ${job.label.toLowerCase()}`,
        passwordHash: hashPassword(DEMO_PASSWORD),
        // Recorded, so the sign-in page can advertise it after checking it against the hash.
        demoCredential: env.DEMO_LOGINS ? DEMO_PASSWORD : null,
        role: job.baseRole,
        // The tenant's own job, which is where this person's permissions come from.
        roleKey: defined.length ? job.key : null,
        engineKinds: [],
        activityKeys,
        siteId: station?.siteId ?? '',
        stationId: station?._id ?? '',
        kioskId: desk?._id ?? null,
        active: true,
      })

      results.push({ profile: job.key, email, role: job.baseRole, created: true })
    }

    logger.info('Tenant demo staff seeded', {
      tenant: registry.slug,
      from: defined.length ? 'tenant role definitions' : 'platform profiles',
      created: results.filter((r) => r.created).length,
      existing: results.filter((r) => !r.created).length,
    })

    return results
  })
}
