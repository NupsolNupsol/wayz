import { logger } from '../config/logger.js'
import { seedFresh } from './seed.js'
import { bootstrapApp } from '../platform/bootstrap.js'
import { closeAllConnections } from '../platform/connections.js'
import { runInOrg } from '../platform/orgScope.js'

/** Seeds one organisation. Defaults to WAYZ so the existing developer workflow is unchanged. */
async function run() {
  const organizationId = process.env.SEED_TENANT ?? 'wayz'
  await bootstrapApp()
  await runInOrg(organizationId, () => seedFresh())
  await closeAllConnections()
  logger.info('Seed CLI finished', { organisation: organizationId })
  process.exit(0)
}

run().catch((err) => {
  logger.error('Seed failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
