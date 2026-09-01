import { Queue, Worker } from 'bullmq'
import { env } from '../config/env.js'
import { getRedis } from '../config/redis.js'
import { logger } from '../config/logger.js'
import { runSessionSweeps } from '../services/overtime.service.js'

let started = false

export async function startReminderWorker(): Promise<void> {
  const connection = getRedis()
  if (!env.QUEUE_ENABLED || !connection || started) return
  started = true

  const queue = new Queue('reminders', { connection })
  await queue.add('session-sweep', {}, { repeat: { every: 60_000 }, removeOnComplete: true, removeOnFail: true })

  new Worker(
    'reminders',
    async () => {
      await runSessionSweeps()
    },
    { connection },
  )

  logger.info('Reminder worker started (BullMQ)')
}
