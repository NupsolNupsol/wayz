import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { bootstrapPlatform } from '../platform/bootstrap.js'
import { closeAllConnections } from '../platform/connections.js'
import { seedTenantDemoStaff } from './tenantStaff.seed.js'

/**
 * `npm run seed:staff -- <handle>` — one demonstration account per job the tenant can staff.
 *
 * Separate from `npm run seed`, which rewrites WAYZ's development dataset wholesale. This
 * only adds accounts that are missing and never touches one that exists, so it is safe to run
 * against a tenant somebody has been working in.
 */
async function run() {
  const slug = process.argv[2] ?? process.env.SEED_TENANT_SLUG
  if (!slug) {
    console.error('Usage: npm run seed:staff -- <tenant-handle>')
    process.exitCode = 1
    return
  }

  if (!env.DEMO_LOGINS) {
    console.error('DEMO_LOGINS is false. Refusing to seed demonstration accounts into a deployment')
    console.error('that has said it is not a demonstration. Nothing was written.')
    process.exitCode = 1
    return
  }

  await connectDB(env.MONGODB_URI)
  await bootstrapPlatform()

  const accounts = await seedTenantDemoStaff(slug)

  console.log(`\nDemonstration staff for "${slug}"`)
  console.log('-'.repeat(64))
  for (const a of accounts) {
    console.log(`  ${a.created ? 'created ' : 'existing'}  ${a.profile.padEnd(18)} ${a.email}`)
  }
  console.log('-'.repeat(64))
  console.log(`  ${accounts.filter((a) => a.created).length} created, ${accounts.filter((a) => !a.created).length} already present\n`)
}

run()
  .catch((err) => {
    logger.error('Tenant staff seed failed', { err: err instanceof Error ? err.message : String(err) })
    console.error('\nFAILED:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeAllConnections().catch(() => undefined)
    await disconnectDB().catch(() => undefined)
  })
