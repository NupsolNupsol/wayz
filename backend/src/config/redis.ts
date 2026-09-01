import IORedis, { type Redis } from 'ioredis'
import { env } from './env.js'
import { logger } from './logger.js'

let connection: Redis | null = null

export function getRedis(): Redis | null {
  if (!env.QUEUE_ENABLED) return null
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
    connection.on('error', (err) => logger.warn('Redis error', { err: err.message }))
    connection.on('connect', () => logger.info('Redis connected'))
  }
  return connection
}

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit()
    connection = null
  }
}
