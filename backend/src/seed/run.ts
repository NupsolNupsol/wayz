import { logger } from '../config/logger.js'
import { seedFresh } from './seed.js'
import { bootstrapApp } from '../platform/bootstrap.js'
import { ensurePlatformAdmin } from '../platform/platformAdminBootstrap.js'
import { closeAllConnections } from '../platform/connections.js'
import { runInOrg } from '../platform/orgScope.js'
import { env } from '../config/env.js'

/** Seeds one organisation. Defaults to WAYZ so the existing developer workflow is unchanged. */
async function run() {
  const organizationId = process.env.SEED_TENANT ?? 'wayz'
  await bootstrapApp()
  await runInOrg(organizationId, () => seedFresh())

  /*
   * The platform administrator, from the environment.
   *
   * The API already does this at boot; doing it here as well means a server that has been
   * seeded has somebody who can sign in to the console, without having to know that the two
   * are separate steps. It is the same function, so running both is not two accounts.
   *
   * The credential is deliberately *not* seeded from source. An account that can create
   * companies and read every company's revenue must not be readable by anybody who can read
   * the repository, so it comes from the machine and nowhere else.
   */
  await ensurePlatformAdmin()

  if (env.PLATFORM_ADMIN_EMAIL) {
    /* The address, never the password. */
    logger.info('Platform console ready', {
      signInAt: `${env.PUBLIC_APP_URL ?? 'http://localhost:5175'}/login`,
      then: '/platform',
      email: env.PLATFORM_ADMIN_EMAIL,
    })
  } else {
    logger.warn('No platform administrator was created', {
      why: 'PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are not set in this environment.',
      fix: 'Set both, then run the seed again — or just restart the API, which does the same thing.',
    })
  }

  await closeAllConnections()
  logger.info('Seed CLI finished', { organisation: organizationId })
  process.exit(0)
}

run().catch((err) => {
  logger.error('Seed failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
