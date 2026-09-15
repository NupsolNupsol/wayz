import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { bootstrapPlatform } from '../platform/bootstrap.js'
import { closeAllConnections, platformDb } from '../platform/connections.js'
import { assertDemonstrationDeployment, seedDemoPlatform } from './demoPlatform.seed.js'

/**
 * `npm run seed:platform` — a demonstration deployment, from nothing to signed-in.
 *
 * The one command to run on a fresh demo machine. Safe to run again on every deploy: a tenant
 * that exists is reconciled rather than recreated, and no tenant's own data is touched.
 */
async function run() {
  assertDemonstrationDeployment()

  console.log('\nLockerFlow · demonstration platform seed')
  console.log('='.repeat(70))

  await connectDB(env.MONGODB_URI)

  /*
   * The platform administrator and WAYZ's adoption both happen here.
   *
   * `bootstrapPlatform` creates the first super admin from the environment if none exists,
   * registers WAYZ, and copies the legacy database into it. All three are no-ops the second
   * time, which is what makes the whole command repeatable.
   */
  await bootstrapPlatform()

  const report = await seedDemoPlatform()
  const { PlatformAdmin } = platformDb()
  const admins = await PlatformAdmin.find({}, { email: 1, fullName: 1 }).lean()

  console.log('')
  console.log(`Platform administrators (${admins.length})`)
  for (const a of admins) console.log(`  ${a.email}`)
  if (admins.length === 0) {
    console.log('  none — set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD and run this again,')
    console.log('  or nobody can sign in at /platform/login.')
  }

  console.log('')
  console.log('Tenants')
  for (const t of report.tenants) {
    console.log(`  ${t.slug.padEnd(10)} ${t.action.padEnd(11)} ${t.staff} demo account(s) added`)
  }

  console.log('')
  console.log('Sign in at:')
  console.log('  /platform/login   the control plane')
  for (const t of report.tenants) console.log(`  /t/${t.slug}/login`.padEnd(20) + `${t.slug.toUpperCase()}`)
  console.log('')
  console.log('Each tenant\'s own sign-in page lists the accounts it actually holds, verified')
  console.log('against the stored hashes. Set DEMO_LOGINS=false and none of it exists.')
  console.log('')
}

run()
  .catch((err) => {
    logger.error('Demo platform seed failed', { err: err instanceof Error ? err.message : String(err) })
    console.error('\nFAILED:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeAllConnections().catch(() => undefined)
    await disconnectDB().catch(() => undefined)
  })
