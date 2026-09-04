import { createApp } from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { seedIfEmpty } from './seed/seed.js'
import { startReminderWorker } from './workers/reminder.worker.js'
import { runSessionSweeps } from './services/overtime.service.js'
import { isPubliclyFetchable } from './services/whatsapp.service.js'

async function main() {
  await connectDB(env.MONGODB_URI)
  if (env.AUTO_SEED) await seedIfEmpty()

  if (env.QUEUE_ENABLED) {
    await startReminderWorker()
  } else {
    setInterval(() => void runSessionSweeps(), 60_000).unref()
  }

  const publicApi = env.PUBLIC_API_URL ?? ''
  if (!isPubliclyFetchable(publicApi)) {
    logger.warn('WhatsApp invoices will send as text only: PUBLIC_API_URL is not publicly reachable', {
      publicApiUrl: publicApi || '(unset)',
      fix: 'Expose the API (e.g. cloudflared tunnel --url http://localhost:4000) and set PUBLIC_API_URL to that https address.',
    })
  }

  const app = createApp()
  const server = app.listen(env.PORT, () =>
    logger.info('WAYZ API listening', { port: env.PORT, env: env.NODE_ENV }),
  )

  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000
}

main().catch((err) => {
  logger.error('Boot failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
