import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { seedVersions } from './versions.seed.js'

async function run() {
  await connectDB(env.MONGODB_URI)
  const releases = await seedVersions()
  await disconnectDB()
  logger.info('Release notes seeded', { releases })
  process.exit(0)
}

run().catch((err) => {
  logger.error('Release notes seed failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
