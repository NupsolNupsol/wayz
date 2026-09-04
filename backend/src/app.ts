import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { mountRoutes } from './routes/index.route.js'
import { errorHandler, notFound } from './middlewares/error.js'
import { auditRequests } from './middlewares/audit.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  const origins = env.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean)
  app.use(cors({ origin: origins.length > 1 ? origins : origins[0], credentials: true }))
  app.use(express.json({ limit: '5mb' }))
  app.use(cookieParser())
  app.use(auditRequests)

  mountRoutes(app)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
