import mongoose from 'mongoose'
import { logger } from './logger.js'

export async function connectDB(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true)
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  logger.info('MongoDB connected', { host: conn.connection.host, db: conn.connection.name })
  return conn
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect()
  logger.info('MongoDB disconnected')
}
