import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'

import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { ApiError } from '../../utils/ApiError.js'
import type { Role } from '../../domain/types.js'

/**
 * The only door between LockerFlow and the learning/AI service.
 *
 * The problem this solves is the one the whole feature turns on: the AI service has to know
 * which company is asking, and the browser must not be the thing that tells it. A request
 * body saying `tenantId` would be a request body an employee of another company can also
 * write.
 *
 * So the tenant is never sent as data. It is sent as a *claim inside a signature* that only
 * this process can produce:
 *
 *   1. every call mints a JWT that lives for two minutes, signed with AI_SERVICE_SECRET;
 *   2. its `ctx` carries the tenant, the role and the user id — all read out of the request's
 *      own verified session or the control-plane session, never out of its body;
 *   3. the AI service refuses anything whose signature, issuer, audience or expiry is wrong,
 *      and builds its Qdrant filter from that context and from nothing else.
 *
 * AI_SERVICE_SECRET is deliberately *not* JWT_SECRET. They protect different things and a
 * leak of one must not become the ability to forge the other — a stolen tenant token should
 * not become a key that can mint "I am a platform administrator" to the AI service.
 */

const AI_AUDIENCE = 'lockerflow-ai'
const AI_ISSUER = 'lockerflow-api'
const TOKEN_TTL_SECONDS = 120

export interface EmployeeActor {
  kind: 'EMPLOYEE'
  userId: string
  tenantId: string
  tenantSlug: string
  tenantName: string
  role: Role
  locale?: string
  displayName?: string
}

export interface PlatformAdminActor {
  kind: 'PLATFORM_ADMIN'
  adminId: string
  displayName?: string
}

export type AiActor = EmployeeActor | PlatformAdminActor

/** Whether this deployment has an assistant at all. Unset secret means the feature is off. */
export const learningEnabled = (): boolean => Boolean(env.AI_SERVICE_SECRET && env.AI_SERVICE_URL)

function assertEnabled(): void {
  if (!learningEnabled()) {
    throw ApiError.unprocessable('The learning assistant is not configured on this server.', [
      'Set AI_SERVICE_SECRET and AI_SERVICE_URL, and start the learning-ai service.',
    ])
  }
}

function signActorToken(actor: AiActor): string {
  const ctx =
    actor.kind === 'EMPLOYEE'
      ? {
          kind: 'EMPLOYEE',
          tenantId: actor.tenantId,
          tenantSlug: actor.tenantSlug,
          tenantName: actor.tenantName,
          role: actor.role,
          locale: actor.locale ?? 'ar',
          displayName: actor.displayName ?? '',
        }
      : { kind: 'PLATFORM_ADMIN', locale: 'en', displayName: actor.displayName ?? '' }

  return jwt.sign({ ctx }, env.AI_SERVICE_SECRET as string, {
    algorithm: 'HS256',
    audience: AI_AUDIENCE,
    issuer: AI_ISSUER,
    subject: actor.kind === 'EMPLOYEE' ? actor.userId : actor.adminId,
    expiresIn: TOKEN_TTL_SECONDS,
    jwtid: randomUUID(),
  })
}

interface AiFailureBody {
  code?: string
  message?: string
  errors?: string[]
}

/**
 * Turns the AI service's answer into this API's answer.
 *
 * The Arabic message the AI service produced is passed through, because it was written for
 * the employee who will read it. Everything else about the failure — the provider, the host,
 * the exception type — stays on this side of the wire and goes to the log.
 */
function translateFailure(status: number, body: AiFailureBody | null, requestId: string): ApiError {
  const message = body?.message || 'تعذّر الوصول إلى المساعد الذكي حالياً.'
  if (status === 401 || status === 403) {
    logger.error('AI service rejected our service token', { status, requestId })
    // Never surfaced as 401: a failure of *our* credential must not look to the browser like
    // the employee's session has ended, which would sign them out of LockerFlow entirely.
    return ApiError.unprocessable(message)
  }
  if (status === 404) return ApiError.notFound(message)
  if (status === 422) return ApiError.unprocessable(message, body?.errors)
  if (status === 503) return new ApiError(503, message)
  return new ApiError(status >= 400 && status < 600 ? status : 502, message)
}

async function call<T>(
  actor: AiActor,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  expect: 'json' | 'binary' = 'json',
): Promise<T> {
  assertEnabled()

  const requestId = randomUUID().slice(0, 16)
  const url = `${env.AI_SERVICE_URL!.replace(/\/$/, '')}${path}`
  const startedAt = Date.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.AI_SERVICE_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${signActorToken(actor)}`,
        'x-request-id': requestId,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    // A dead AI service must not read as a broken LockerFlow. The log has the detail; the
    // employee gets one sentence in Arabic.
    logger.error('AI service unreachable', {
      requestId,
      path,
      reason: error instanceof Error ? error.name : 'unknown',
      durationMs: Date.now() - startedAt,
    })
    throw new ApiError(503, 'المساعد الذكي غير متاح حالياً. حاول مرة أخرى بعد قليل.')
  } finally {
    clearTimeout(timeout)
  }

  const durationMs = Date.now() - startedAt

  if (!response.ok) {
    let failure: AiFailureBody | null = null
    try {
      failure = (await response.json()) as AiFailureBody
    } catch {
      failure = null
    }
    logger.warn('AI service refused a request', {
      requestId,
      path,
      status: response.status,
      code: failure?.code,
      durationMs,
    })
    throw translateFailure(response.status, failure, requestId)
  }

  logger.info('AI service call', { requestId, path, status: response.status, durationMs })

  if (expect === 'binary') {
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    } as T
  }
  return (await response.json()) as T
}

export const aiClient = {
  get: <T>(actor: AiActor, path: string) => call<T>(actor, 'GET', path),
  post: <T>(actor: AiActor, path: string, body?: unknown) => call<T>(actor, 'POST', path, body),
  patch: <T>(actor: AiActor, path: string, body?: unknown) => call<T>(actor, 'PATCH', path, body),
  remove: <T>(actor: AiActor, path: string) => call<T>(actor, 'DELETE', path),
  binary: (actor: AiActor, path: string, body?: unknown) =>
    call<{ buffer: Buffer; contentType: string }>(actor, 'POST', path, body, 'binary'),

  /** Readiness, for the control plane's health screen. Never throws — it reports. */
  async health(): Promise<{ reachable: boolean; status: string; checks?: unknown }> {
    if (!learningEnabled()) return { reachable: false, status: 'not-configured' }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5_000)
      const response = await fetch(`${env.AI_SERVICE_URL!.replace(/\/$/, '')}/health/ready`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const body = (await response.json()) as { status?: string; checks?: unknown }
      return { reachable: true, status: body.status ?? 'unknown', checks: body.checks }
    } catch {
      return { reachable: false, status: 'unreachable' }
    }
  },
}
