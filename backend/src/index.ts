import { createApp } from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { seedIfEmpty } from './seed/seed.js'
import { startReminderWorker } from './workers/reminder.worker.js'
import { runSessionSweeps } from './services/overtime.service.js'

async function main() {
  await connectDB(env.MONGODB_URI)
  if (env.AUTO_SEED) await seedIfEmpty()

  if (env.QUEUE_ENABLED) {
    await startReminderWorker()
  } else {
    setInterval(() => void runSessionSweeps(), 60_000).unref()
  }

  const app = createApp()
  const server = app.listen(env.PORT, () =>
    logger.info('WAYZ API listening', { port: env.PORT, env: env.NODE_ENV }),
  )

  // A proxy in front of us must never hold a socket this server is about to close: that race
  // surfaces to the browser as a 500 nothing here ever saw. Outliving the caller avoids it.
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000
}

main().catch((err) => {
  logger.error('Boot failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
