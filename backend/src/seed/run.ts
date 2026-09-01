import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { seedFresh } from './seed.js'

async function run() {
  await connectDB(env.MONGODB_URI)
  await seedFresh()
  await disconnectDB()
  logger.info('Seed CLI finished')
  process.exit(0)
}

run().catch((err) => {
  logger.error('Seed failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
