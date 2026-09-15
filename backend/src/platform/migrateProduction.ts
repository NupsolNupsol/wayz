/**
 * Moves an existing single-tenant WAYZ deployment onto the multi-tenant architecture.
 *
 * Run once, by hand, on the server that already holds live data. It is separate from the
 * normal deployment path on purpose: a data migration that runs on every `git pull` is a
 * migration nobody is watching, and the one time it behaves unexpectedly will be a time
 * nobody is looking at the logs.
 *
 * What it will and will not do:
 *
 *   - It creates the control-plane database and reconciles it. Safe to repeat.
 *   - It registers WAYZ and gives it a database of its own. Safe to repeat.
 *   - It **copies** the existing data. It never moves and never deletes: the original
 *     database is left exactly as found, so a bad outcome costs nothing but disk.
 *   - It refuses to copy into a tenant database that already holds data, so a second run
 *     cannot duplicate documents.
 *   - It verifies afterwards, collection by collection, and says plainly whether the counts
 *     match. A migration that reports success without counting is a guess.
 *
 * If it fails part way, run it again. Everything it does is idempotent, and the report says
 * where it stopped.
 */

import mongoose from 'mongoose'

import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { connectDB } from '../config/db.js'
import { closeAllConnections, connectPlatform, platformDb, tenantConnection, tenantDbNameFor } from './connections.js'
import { bootstrapPlatform, copyLegacyIntoTenant } from './bootstrap.js'
import type { TenantRegistryDoc } from './registry.model.js'

const LEGACY_TENANT_ID = 'wayz'

interface CollectionCheck {
  name: string
  source: number
  target: number
}

const tick = (ok: boolean) => (ok ? '  ok  ' : ' FAIL ')

async function verify(legacyName: string, dbName: string): Promise<CollectionCheck[]> {
  const client = mongoose.connection.getClient()
  const source = client.db(legacyName)
  const target = client.db(dbName)

  const collections = await source.listCollections().toArray()
  const checks: CollectionCheck[] = []

  for (const { name } of collections) {
    const [a, b] = await Promise.all([
      source.collection(name).countDocuments(),
      target.collection(name).countDocuments(),
    ])
    checks.push({ name, source: a, target: b })
  }

  return checks.sort((x, y) => y.source - x.source)
}

async function run(): Promise<void> {
  console.log('\nLockerFlow · production migration to the multi-tenant architecture')
  console.log('='.repeat(72))
  console.log(`Mongo         ${env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`)
  console.log(`Control plane ${env.PLATFORM_DB_NAME}`)
  console.log('')

  // The legacy connection is the one the single-tenant deployment has always used.
  await connectDB(env.MONGODB_URI)
  const legacyName = mongoose.connection.name
  console.log(`Legacy database   ${legacyName}`)

  await connectPlatform()
  console.log('Control plane     connected')

  /*
   * bootstrapPlatform does the reconciling: it creates the first super admin if the
   * environment names one, registers WAYZ if it is not registered, and copies the legacy
   * data into the tenant database if that database is empty. Every one of those is a no-op
   * the second time, which is what makes running this twice harmless.
   */
  await bootstrapPlatform()

  const { TenantRegistry, PlatformAdmin } = platformDb()
  const registry = await TenantRegistry.findById(LEGACY_TENANT_ID).lean<TenantRegistryDoc>()

  if (!registry) {
    console.error('\nFAILED: WAYZ is not in the registry and could not be registered.')
    console.error('Nothing was copied and nothing was changed. Check the log above and run again.')
    process.exitCode = 1
    return
  }

  const dbName = registry.dbName
  console.log(`Tenant database   ${dbName}`)
  if (dbName !== tenantDbNameFor(registry.slug)) {
    console.log(`  (registry names a non-default database — using the registry, as always)`)
  }

  // Touch the connection so the database exists even when the copy was a no-op.
  await tenantConnection(dbName)

  /*
   * Did this run copy anything, or was it already done?
   *
   * bootstrapPlatform above has already attempted the copy; asking again returns the state
   * without repeating it. The answer decides what an honest verification even is.
   */
  const outcome = await copyLegacyIntoTenant(dbName)
  const admins = await PlatformAdmin.estimatedDocumentCount()

  if (outcome.state === 'SAME_DATABASE') {
    console.log('\nnothing to migrate: the legacy and tenant databases are the same.')
    return
  }

  if (outcome.state === 'NOTHING_TO_COPY') {
    console.log('\nThe legacy database holds no collections. Nothing to migrate.')
    console.log(`  Platform administrators: ${admins}`)
    return
  }

  if (outcome.state === 'ALREADY_POPULATED') {
    /*
     * Already migrated, possibly a long time ago.
     *
     * The tenant has been live since, so its counts have moved on while the original stayed
     * frozen. Comparing them here would report a failure that is only business having
     * happened — so they are deliberately not compared, and it says why. What is checked is
     * the thing that still matters: the tenant database is real and holds data.
     */
    const client = mongoose.connection.getClient()
    const target = client.db(dbName)
    const collections = await target.listCollections().toArray()
    let documents = 0
    for (const { name } of collections) documents += await target.collection(name).countDocuments()

    console.log('\nAlready migrated — nothing was copied.')
    console.log('-'.repeat(72))
    console.log(`  ${dbName} holds ${collections.length} collections and ${documents} documents.`)
    console.log(`  Platform administrators: ${admins}`)
    console.log('')
    console.log(`  "${legacyName}" is a frozen snapshot from the day of the migration.`)
    console.log('  Its counts are NOT compared: the tenant has been live since, so they are')
    console.log('  expected to differ and comparing them would be meaningless.')
    console.log('')

    if (documents === 0) {
      console.error('FAILED: the tenant database exists but is empty.')
      console.error('Nothing was deleted. Investigate before starting the API.')
      process.exitCode = 1
      return
    }

    console.log('  Safe to run again. This run changed nothing and deleted nothing.')
    console.log('')
    return
  }

  console.log(`\nCopied ${outcome.documents} documents. Verifying, collection by collection`)
  console.log('-'.repeat(72))
  const checks = await verify(legacyName, dbName)

  let mismatched = 0
  let totalSource = 0
  let totalTarget = 0

  for (const c of checks) {
    const ok = c.target >= c.source
    if (!ok) mismatched += 1
    totalSource += c.source
    totalTarget += c.target
    console.log(`${tick(ok)} ${c.name.padEnd(28)} ${String(c.source).padStart(7)} -> ${String(c.target).padStart(7)}`)
  }

  console.log('-'.repeat(72))
  console.log(`  ${checks.length} collections · ${totalSource} documents copied from the original`)
  console.log(`  Platform administrators: ${admins}`)
  console.log('')

  if (mismatched > 0) {
    console.error(`FAILED: ${mismatched} collection(s) hold fewer documents than the original.`)
    console.error('The original database has NOT been touched. Investigate, then run this again.')
    process.exitCode = 1
    return
  }

  if (admins === 0) {
    console.log('WARNING: no platform administrator exists yet.')
    console.log('  Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD and restart the API,')
    console.log('  or nobody can sign in to the control plane at /platform/login.')
    console.log('')
  }

  console.log('DONE. WAYZ is live on its own database.')
  console.log('')
  console.log(`  The original database "${legacyName}" was left exactly as it was found.`)
  console.log('  Keep it until you are satisfied, then remove it deliberately — never automatically.')
  console.log('')
  console.log('  Next: start the API normally. Do not run this command again as part of a deploy.')
  console.log('')
}

run()
  .catch((err) => {
    logger.error('Production migration failed', { err: err instanceof Error ? err.message : String(err) })
    console.error('\nFAILED:', err instanceof Error ? err.message : err)
    console.error('Nothing was deleted. Fix the cause and run this command again.')
    process.exitCode = 1
  })
  .finally(async () => {
    await closeAllConnections().catch(() => undefined)
    await mongoose.disconnect().catch(() => undefined)
  })
