import mongoose from 'mongoose'

import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { bootstrapPlatform } from './bootstrap.js'
import { closeAllConnections, dropTenantDatabase, platformDb, tenantDbNameFor } from './connections.js'
import { forgetTenant } from './tenantContext.js'
import type { TenantRegistryDoc } from './registry.model.js'

/**
 * Deletes one development tenant, so it can be provisioned again from nothing.
 *
 * This is the most destructive thing in the repository, so it is also the most guarded. It
 * exists because a tenant that grew up alongside a wrong abstraction carries that abstraction
 * in its data — configuration that was correct when it was written and is wrong now — and the
 * only honest way to prove a corrected provisioning path works is to run it against nothing.
 *
 * ## What it refuses to do
 *
 * Five checks, each of which alone is enough to stop it:
 *
 *   1. **Not on a live deployment.** `MODE=live` refuses outright, whatever else is true.
 *   2. **Not without a demonstration flag.** `DEMO_LOGINS` must be on.
 *   3. **Not against a remote database.** The connection must be to localhost.
 *   4. **Only a tenant named on the command line**, and never one on the protected list.
 *   5. **Only the database the registry says belongs to that tenant** — and the name is
 *      checked against the expected shape before anything is dropped, so a corrupted registry
 *      row cannot point this at something else.
 *
 * ## What it never touches
 *
 * `lockerflow` (the frozen original), `lockerflow_platform` beyond the one registry row, and
 * every other tenant's database. Those are named explicitly below rather than left implicit.
 */

/** Databases this command must never drop, whatever it is asked. */
const PROTECTED_DATABASES = ['lockerflow', 'lockerflow_platform', 'admin', 'local', 'config']

/** Tenants this command must never reset. WAYZ carries the original production data. */
const PROTECTED_TENANTS = ['wayz']

export interface ResetReport {
  slug: string
  dbName: string
  droppedDatabase: boolean
  removedRegistryRow: boolean
}

export class ResetRefused extends Error {}

function assertSafeEnvironment(): void {
  if (env.MODE === 'live') {
    throw new ResetRefused('MODE is live. A tenant reset is a development tool and will not run against a live deployment.')
  }
  if (!env.DEMO_LOGINS) {
    throw new ResetRefused(
      'DEMO_LOGINS is false, so this deployment has said it is not a demonstration. Refusing to delete a tenant.',
    )
  }

  /*
   * Local only.
   *
   * A connection string pointing anywhere but this machine is the one mistake that turns a
   * development convenience into an outage, so it is checked rather than assumed.
   */
  const uri = env.MONGODB_URI
  const host = uri.replace(/^mongodb(\+srv)?:\/\//, '').replace(/^[^@]*@/, '').split('/')[0]
  const localish = /^(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal|mongo)(:\d+)?$/i.test(host)
  if (!localish) {
    throw new ResetRefused(`MONGODB_URI points at "${host}", which is not this machine. Refusing to delete a tenant.`)
  }
}

export async function resetTenant(slug: string): Promise<ResetReport> {
  assertSafeEnvironment()

  const handle = slug.trim().toLowerCase()
  if (!handle) throw new ResetRefused('Name the tenant to reset.')
  if (PROTECTED_TENANTS.includes(handle)) {
    throw new ResetRefused(`"${handle}" is protected and will never be reset by this command.`)
  }

  const { TenantRegistry } = platformDb()
  const row = await TenantRegistry.findOne({ slug: handle }).lean<TenantRegistryDoc>()
  if (!row) throw new ResetRefused(`No tenant is registered under the handle "${handle}".`)

  const dbName = row.dbName

  /*
   * The database has to be the one this tenant's handle would produce.
   *
   * A registry row is editable, and a row pointing somewhere unexpected is either a mistake or
   * something worse. Either way it is not a thing to drop on trust.
   */
  const expected = tenantDbNameFor(handle)
  if (dbName !== expected) {
    throw new ResetRefused(
      `The registry says "${handle}" lives in "${dbName}", but its handle would produce "${expected}". Refusing to drop a database this command cannot vouch for.`,
    )
  }
  if (PROTECTED_DATABASES.includes(dbName)) {
    throw new ResetRefused(`"${dbName}" is protected and will never be dropped.`)
  }

  logger.warn('Resetting a development tenant', { slug: handle, dbName })

  await dropTenantDatabase(dbName)
  forgetTenant(row._id)
  await TenantRegistry.deleteOne({ _id: row._id })

  return { slug: handle, dbName, droppedDatabase: true, removedRegistryRow: true }
}

/** `npm run reset:tenant -- <handle>` */
async function run() {
  const slug = process.argv[2]

  console.log('\nLockerFlow · development tenant reset')
  console.log('='.repeat(70))

  if (!slug) {
    console.error('Usage: npm run reset:tenant -- <handle>')
    console.error('')
    console.error('Deletes one development tenant entirely — its database and its registry row —')
    console.error('so it can be provisioned again from nothing.')
    console.error('')
    console.error(`Never touches: ${[...PROTECTED_DATABASES, ...PROTECTED_TENANTS.map((t) => `tenant "${t}"`)].join(', ')}`)
    process.exitCode = 1
    return
  }

  await connectDB(env.MONGODB_URI)
  await bootstrapPlatform()

  console.log(`Mongo         ${env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`)
  console.log(`Mode          ${env.MODE}`)
  console.log('')

  const before = await mongoose.connection.getClient().db().admin().listDatabases()
  const named = before.databases.map((d) => d.name).filter((n) => n.startsWith('lockerflow'))
  console.log('Databases before:')
  for (const n of named) console.log(`  ${n}`)
  console.log('')

  const report = await resetTenant(slug)

  const after = await mongoose.connection.getClient().db().admin().listDatabases()
  const left = after.databases.map((d) => d.name).filter((n) => n.startsWith('lockerflow'))

  console.log(`Dropped       ${report.dbName}`)
  console.log(`Registry row  removed`)
  console.log('')
  console.log('Databases after:')
  for (const n of left) console.log(`  ${n}`)
  console.log('')

  /* Say plainly that the things which must survive, did. */
  for (const survivor of ['lockerflow', 'lockerflow_platform', 'lockerflow_t_wayz']) {
    const ok = left.includes(survivor)
    console.log(`  ${ok ? 'intact ' : 'MISSING'}  ${survivor}`)
    if (!ok && survivor !== 'lockerflow_t_wayz') process.exitCode = 1
  }
  console.log('')
  console.log(`Provision it again with: npm run provision:${report.slug}`)
  console.log('')
}

if (process.argv[1]?.includes('resetTenant')) {
  run()
    .catch((err) => {
      if (err instanceof ResetRefused) {
        console.error(`\nREFUSED: ${err.message}\n`)
        console.error('Nothing was deleted.\n')
      } else {
        logger.error('Tenant reset failed', { err: err instanceof Error ? err.message : String(err) })
        console.error('\nFAILED:', err instanceof Error ? err.message : err)
      }
      process.exitCode = 1
    })
    .finally(async () => {
      await closeAllConnections().catch(() => undefined)
      await disconnectDB().catch(() => undefined)
    })
}
