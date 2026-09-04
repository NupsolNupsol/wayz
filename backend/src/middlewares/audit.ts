import type { NextFunction, Request, Response } from 'express'
import { auditAlreadyWritten, inAuditContext, recordAudit } from '../services/audit.service.js'

const IGNORED = [/^\/api\/auth\/invitation\//, /^\/api\/otp\/peek$/, /^\/api\/health$/]

const ENTITY_BY_SEGMENT: Record<string, string> = {
  bookings: 'Booking',
  customers: 'Customer',
  deliveries: 'Delivery',
  incidents: 'Incident',
  shift: 'Shift',
  till: 'Payment',
  notifications: 'Notification',
  'manual-sales': 'ManualSale',
  'refund-requests': 'Booking',
  catalogue: 'Catalogue',
  manager: 'Tenant',
  admin: 'Tenant',
  accounting: 'Accounting',
  hr: 'Payroll',
  auth: 'Session',
  otp: 'Verification',
  transactions: 'CardTransaction',
  assets: 'Asset',
}

const looksLikeId = (segment: string) =>
  /\d/.test(segment) || segment.includes('_') || segment.length > 24

const VERB: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' }

function idFromResponse(body: unknown): string | null {
  const data = (body as { data?: unknown })?.data
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const direct = record._id ?? record.id
  if (typeof direct === 'string') return direct
  for (const nested of Object.values(record)) {
    const id = (nested as { _id?: unknown; id?: unknown })?.id ?? (nested as { _id?: unknown })?._id
    if (typeof id === 'string') return id
  }
  return null
}

export function describeRequest(method: string, path: string): { action: string; entity: string; entityId: string } {
  const segments = path.split('/').filter(Boolean)
  if (segments[0] === 'api') segments.shift()

  const words = segments.filter((s) => !looksLikeId(s))
  const ids = segments.filter(looksLikeId)

  const tail = words.slice(1).join('_').replaceAll('-', '_').toUpperCase()
  const head = (words[0] ?? 'request').replaceAll('-', '_').toUpperCase()
  const verb = VERB[method] ?? method
  const action = tail ? (method === 'POST' ? `${head}_${tail}` : `${head}_${tail}_${verb}`) : `${head}_${verb}`

  return {
    action,
    entity: ENTITY_BY_SEGMENT[words[0] ?? ''] ?? (words[0] ?? 'Request'),
    entityId: ids[ids.length - 1] ?? '',
  }
}

export function auditRequests(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (IGNORED.some((rx) => rx.test(req.originalUrl))) return next()

  const path = req.originalUrl.split('?')[0]

  inAuditContext(() => {
    let created: string | null = null
    const json = res.json.bind(res)
    res.json = (body: unknown) => {
      created = idFromResponse(body)
      return json(body)
    }

    res.on('finish', () => {
      if (res.statusCode >= 400 || auditAlreadyWritten()) return
      const auth = req.auth
      if (!auth) return

      const { action, entity, entityId } = describeRequest(req.method, path)
      void recordAudit({
        tenantId: auth.tenantId,
        actorId: auth.sub,
        action,
        entity,
        entityId: entityId || created || '—',
        detail: `${req.method} ${path}`,
      })
    })
    next()
  })
}
