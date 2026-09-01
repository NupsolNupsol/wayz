import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { logger } from '../config/logger.js'

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound('Route not found.'))
}

function zodErrors(err: ZodError): string[] {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const errors = zodErrors(err)
    return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid request.', errors })
  }

  const isApi = err instanceof ApiError
  const statusCode = isApi ? err.statusCode : 500
  const message = err instanceof Error ? err.message : 'Internal server error'
  const errors = isApi ? err.errors : undefined
  if (statusCode >= 500) logger.error('Unhandled error', { message, stack: err instanceof Error ? err.stack : undefined })
  res.status(statusCode).json({ success: false, statusCode, message, errors })
}
