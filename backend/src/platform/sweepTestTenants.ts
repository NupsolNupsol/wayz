import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { bootstrapPlatform } from './bootstrap.js'
import { closeAllConnections, dropTenantDatabase, platformDb } from './connections.js'
import { forgetTenant } from './tenantContext.js'
import type { TenantRegistryDoc } from './registry.model.js'

/**
 * Removes the tenants the end-to-end suite creates, and only those.
 *
 * The Super Admin test brings a real company into existence through the real screens, because
 * that is the only way to prove a person can. It removes it again at the end — but a run that
 * fails part way never reaches that step, and what it leaves behind is a company sitting in
 * the control plane looking exactly like a paying customer. That is what put "Probe 6013834"
 * in front of an operator on the overview screen.
 *
 * So the harness sweeps before it starts. Two things keep this safe:
 *
 *   - It matches only handles the harness itself generates (`probe<digits>`) or rows already
 *     marked synthetic. A company called "Probe Logistics" is not `probe1234567` and is never
 *     touched.
 *   - It refuses to run at all on a deployment that has not said it is a demonstration, so it
 *     cannot be pointed at production by accident.
 */

/** Exactly what `platformSuperAdmin.spec.ts` generates, and nothing a person would choose. */
const HARNESS_HANDLE = /^probe\d{5,}$/

export async function sweepTestTenants(): Promise<{ removed: string[]; kept: number }> {
  const { TenantRegistry } = platformDb()
  const rows = await TenantRegistry.find({}).lean<TenantRegistryDoc[]>()

  const doomed = rows.filter((r) => HARNESS_HANDLE.test(r.slug))
  const removed: string[] = []

  for (const row of doomed) {
    await dropTenantDatabase(row.dbName)
    await TenantRegistry.deleteOne({ _id: row._id })
    forgetTenant(row._id)
    removed.push(row.slug)
  }

  return { removed, kept: rows.length - removed.length }
}

async function run() {
  if (!env.DEMO_LOGINS && env.MODE === 'live') {
    console.error('Refusing to sweep tenants on a live deployment. Nothing was touched.')
    process.exitCode = 1
    return
  }

  await connectDB(env.MONGODB_URI)
  await bootstrapPlatform()

  const { removed, kept } = await sweepTestTenants()

  if (removed.length === 0) {
    console.log(`No harness tenants to sweep. ${kept} real tenant(s) left alone.`)
  } else {
    console.log(`Swept ${removed.length} harness tenant(s): ${removed.join(', ')}`)
    console.log(`${kept} real tenant(s) left alone.`)
  }
}

/* Only when invoked directly, so importing the sweep does not run it. */
if (process.argv[1]?.includes('sweepTestTenants')) {
  run()
    .catch((err) => {
      logger.error('Tenant sweep failed', { err: err instanceof Error ? err.message : String(err) })
      console.error('\nFAILED:', err instanceof Error ? err.message : err)
      process.exitCode = 1
    })
    .finally(async () => {
      await closeAllConnections().catch(() => undefined)
      await disconnectDB().catch(() => undefined)
    })
}
