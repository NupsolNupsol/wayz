import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { seedFresh } from './seed.js'
import { bootstrapPlatform } from '../platform/bootstrap.js'
import { closeAllConnections } from '../platform/connections.js'
import { runInTenant } from '../platform/tenantContext.js'
import { reindexTenantLogins } from '../platform/loginDirectory.js'
import { reindexPublicLinks } from '../platform/publicLinks.js'

/** Seeds one tenant. Defaults to WAYZ so the existing developer workflow is unchanged. */
async function run() {
  const tenantId = process.env.SEED_TENANT ?? 'wayz'
  await connectDB(env.MONGODB_URI)
  await bootstrapPlatform()
  await runInTenant(tenantId, async (ctx) => {
    await seedFresh()
    // Sign-in has no token to read a tenant from, so the directory is refreshed here.
    const indexed = await reindexTenantLogins(ctx.registry)
    await reindexPublicLinks(ctx.registry)
    logger.info('Tenant logins indexed', { tenant: ctx.slug, users: indexed })
  })
  await closeAllConnections()
  await disconnectDB()
  logger.info('Seed CLI finished')
  process.exit(0)
}

run().catch((err) => {
  logger.error('Seed failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
