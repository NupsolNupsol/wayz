import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitOptions {
  windowMs: number
  max: number
  keyOn?: (req: Request) => string
}

export function rateLimit({ windowMs, max, keyOn }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>()

  const prune = (now: number) => {
    if (buckets.size < 5_000) return
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key)
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const client = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const key = keyOn ? `${client}:${keyOn(req)}` : client
    prune(now)

    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    bucket.count += 1
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000))
      throw new ApiError(429, 'Too many requests — slow down.')
    }
    next()
  }
}
