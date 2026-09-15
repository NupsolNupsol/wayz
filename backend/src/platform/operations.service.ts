import mongoose from 'mongoose'

import { env } from '../config/env.js'
import { platformDb, tenantConnection } from './connections.js'
import { CAPABILITIES, PLATFORM_PROFILES } from './capabilities.js'
import type { TenantRegistryDoc } from './registry.model.js'

/**
 * What the control plane can honestly say about itself.
 *
 * Every number here is counted, measured or read from something real. Nothing is estimated,
 * nothing is generated, and where a figure genuinely cannot be obtained it is returned as
 * `null` and the screen omits it rather than showing a plausible-looking invention. A
 * dashboard that makes up numbers is worse than one with fewer of them: it is confidently
 * wrong at exactly the moment somebody is deciding something.
 *
 * The isolation rule holds throughout. Tenant *operational* records — bookings, payments,
 * customers — are never read into the control plane, and none of them appear below. What is
 * counted per tenant is the shape of the tenant itself: whether its database answers, how big
 * it is, how many people can sign in. Those are facts about the platform's own estate, which
 * is the platform's business, and they are read live from each tenant's own connection rather
 * than copied anywhere.
 */

export interface TenantEstateRow {
  slug: string
  name: string
  lifecycle: string
  dbName: string
  isSynthetic: boolean
  createdAt: Date | null
  capabilities: string[]
  /** null when the database could not be reached — which is itself the useful answer. */
  reachable: boolean
  storageBytes: number | null
  collections: number | null
  users: number | null
  sites: number | null
  stations: number | null
  provisioning: { done: number; total: number; failed: boolean }
}

/** Everything the platform knows about one tenant's estate, read from that tenant's own database. */
async function estateOf(row: TenantRegistryDoc): Promise<TenantEstateRow> {
  const steps = row.provisioning?.steps ?? []
  const base = {
    slug: row.slug,
    name: row.name,
    lifecycle: row.lifecycle,
    dbName: row.dbName,
    isSynthetic: row.isSynthetic ?? false,
    createdAt: (row as TenantRegistryDoc & { createdAt?: Date }).createdAt ?? null,
    capabilities: row.capabilities ?? [],
    provisioning: {
      done: steps.filter((s) => s.status === 'DONE').length,
      total: steps.length,
      failed: steps.some((s) => s.status === 'FAILED'),
    },
  }

  try {
    const conn = await tenantConnection(row.dbName)
    const db = conn.db
    if (!db) throw new Error('no database handle')

    /*
     * `dbStats` is the database describing itself, which is the only honest source for how
     * much room a tenant is taking. Counting documents and guessing a size would be a
     * fabrication dressed as a measurement.
     */
    const [stats, users, sites, stations] = await Promise.all([
      db.command({ dbStats: 1 }).catch(() => null),
      db.collection('users').countDocuments().catch(() => null),
      db.collection('sites').countDocuments().catch(() => null),
      db.collection('stations').countDocuments().catch(() => null),
    ])

    return {
      ...base,
      reachable: true,
      storageBytes: typeof stats?.dataSize === 'number' ? stats.dataSize : null,
      collections: typeof stats?.collections === 'number' ? stats.collections : null,
      users,
      sites,
      stations,
    }
  } catch {
    return { ...base, reachable: false, storageBytes: null, collections: null, users: null, sites: null, stations: null }
  }
}

/** Every tenant's estate. `includeSynthetic` keeps test-harness tenants out by default. */
export async function tenantEstate(includeSynthetic = false): Promise<TenantEstateRow[]> {
  const { TenantRegistry } = platformDb()
  const where = includeSynthetic ? {} : { isSynthetic: { $ne: true } }
  const rows = await TenantRegistry.find(where).sort({ createdAt: -1 }).lean<TenantRegistryDoc[]>()
  return Promise.all(rows.map(estateOf))
}

export interface PlatformOverview {
  tenants: { total: number; byLifecycle: Record<string, number>; provisioningFailed: number }
  people: { platformAdmins: number; tenantUsers: number | null }
  estate: { databases: number; reachable: number; storageBytes: number | null }
  activity: { auditEntriesLast7Days: number; lastEventAt: Date | null }
  newestTenants: { slug: string; name: string; lifecycle: string; createdAt: Date | null }[]
}

export async function platformOverview(): Promise<PlatformOverview> {
  const { PlatformAdmin, PlatformAudit } = platformDb()

  const [estate, platformAdmins, weekAgo] = await Promise.all([
    tenantEstate(),
    PlatformAdmin.countDocuments({}),
    Promise.resolve(new Date(Date.now() - 7 * 24 * 3600_000)),
  ])

  const [auditEntriesLast7Days, latest] = await Promise.all([
    PlatformAudit.countDocuments({ at: { $gte: weekAgo } }),
    PlatformAudit.findOne({}).sort({ at: -1 }).lean<{ at?: Date }>(),
  ])

  const byLifecycle: Record<string, number> = {}
  for (const t of estate) byLifecycle[t.lifecycle] = (byLifecycle[t.lifecycle] ?? 0) + 1

  /*
   * Summed only over the tenants that actually answered.
   *
   * If one database is unreachable, the true total is unknown — so the honest answer is null
   * rather than a smaller number presented as complete. The health screen says which one is
   * down; this one declines to guess around it.
   */
  const reachable = estate.filter((t) => t.reachable)
  const allAnswered = reachable.length === estate.length && estate.length > 0

  const sum = (pick: (t: TenantEstateRow) => number | null) =>
    reachable.reduce<number | null>((acc, t) => {
      const v = pick(t)
      return acc === null || v === null ? null : acc + v
    }, 0)

  return {
    tenants: {
      total: estate.length,
      byLifecycle,
      provisioningFailed: estate.filter((t) => t.provisioning.failed).length,
    },
    people: {
      platformAdmins,
      tenantUsers: allAnswered ? sum((t) => t.users) : null,
    },
    estate: {
      databases: estate.length,
      reachable: reachable.length,
      storageBytes: allAnswered ? sum((t) => t.storageBytes) : null,
    },
    activity: { auditEntriesLast7Days, lastEventAt: latest?.at ?? null },
    newestTenants: estate.slice(0, 5).map((t) => ({
      slug: t.slug,
      name: t.name,
      lifecycle: t.lifecycle,
      createdAt: t.createdAt,
    })),
  }
}

export interface HealthReport {
  api: { status: 'UP'; version: string; startedAt: Date; uptimeSeconds: number; mode: string; nodeEnv: string }
  controlPlane: { status: 'UP' | 'DOWN'; database: string; latencyMs: number | null }
  tenantDatabases: { slug: string; dbName: string; status: 'UP' | 'DOWN'; latencyMs: number | null }[]
  provisioning: { failed: { slug: string; name: string; lastError: string | null }[] }
  checkedAt: Date
}

const STARTED_AT = new Date()

/**
 * A live check of everything the platform depends on.
 *
 * Deliberately says nothing that would help somebody attack it: no connection strings, no
 * credentials, no host names, no environment variables. A database is named, because an
 * operator needs to know which one is down, and a name is not a secret in the way a URI with
 * a password in it is.
 */
export async function healthReport(): Promise<HealthReport> {
  const { TenantRegistry } = platformDb()

  const ping = async (run: () => Promise<unknown>): Promise<number | null> => {
    const started = Date.now()
    try {
      await run()
      return Date.now() - started
    } catch {
      return null
    }
  }

  const controlLatency = await ping(() => mongoose.connection.db!.admin().command({ ping: 1 }))

  const rows = await TenantRegistry.find({ isSynthetic: { $ne: true } })
    .sort({ name: 1 })
    .lean<TenantRegistryDoc[]>()

  const tenantDatabases = await Promise.all(
    rows.map(async (row) => {
      const latencyMs = await ping(async () => {
        const conn = await tenantConnection(row.dbName)
        await conn.db!.command({ ping: 1 })
      })
      return {
        slug: row.slug,
        dbName: row.dbName,
        status: (latencyMs === null ? 'DOWN' : 'UP') as 'UP' | 'DOWN',
        latencyMs,
      }
    }),
  )

  return {
    api: {
      status: 'UP',
      version: process.env.npm_package_version ?? '0.0.0',
      startedAt: STARTED_AT,
      uptimeSeconds: Math.round(process.uptime()),
      mode: env.MODE,
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
    controlPlane: {
      status: controlLatency === null ? 'DOWN' : 'UP',
      database: env.PLATFORM_DB_NAME,
      latencyMs: controlLatency,
    },
    tenantDatabases,
    provisioning: {
      failed: rows
        .filter((r) => r.provisioning?.steps?.some((s) => s.status === 'FAILED'))
        .map((r) => ({ slug: r.slug, name: r.name, lastError: r.provisioning?.lastError ?? null })),
    },
    checkedAt: new Date(),
  }
}

export interface PlatformReports {
  growth: { month: string; created: number; cumulative: number }[]
  capabilityAdoption: { key: string; label: string; tenants: number }[]
  profileAdoption: { key: string; label: string; tenants: number }[]
  estate: TenantEstateRow[]
  auditByAction: { action: string; count: number }[]
}

/**
 * Platform-level analytics only.
 *
 * Everything here is about the platform's own estate: how many companies exist, what they are
 * configured to do, how much room they take, what administrators have been doing. No tenant's
 * bookings, payments or customers are read, aggregated or copied — that data belongs to the
 * tenant and stays in the tenant's database, which is the whole point of the architecture.
 */
export async function platformReports(): Promise<PlatformReports> {
  const { TenantRegistry, PlatformAudit } = platformDb()

  const [rows, estate, auditGroups] = await Promise.all([
    TenantRegistry.find({ isSynthetic: { $ne: true } })
      .sort({ createdAt: 1 })
      .lean<(TenantRegistryDoc & { createdAt?: Date })[]>(),
    tenantEstate(),
    PlatformAudit.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
  ])

  const byMonth = new Map<string, number>()
  for (const r of rows) {
    if (!r.createdAt) continue
    const key = new Date(r.createdAt).toISOString().slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
  }

  let running = 0
  const growth = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, created]) => {
      running += created
      return { month, created, cumulative: running }
    })

  const holders = (key: string) => rows.filter((r) => (r.capabilities ?? []).includes(key)).length
  const staffing = (key: string) => rows.filter((r) => (r.enabledProfiles ?? []).includes(key)).length

  return {
    growth,
    capabilityAdoption: CAPABILITIES.map((c) => ({ key: c.key, label: c.label, tenants: holders(c.key) })),
    profileAdoption: PLATFORM_PROFILES.map((p) => ({ key: p.key, label: p.label, tenants: staffing(p.key) })),
    estate,
    auditByAction: auditGroups.map((g) => ({ action: g._id, count: g.count })),
  }
}
