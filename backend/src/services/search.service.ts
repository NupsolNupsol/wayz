import { Booking, CardTransaction, Customer, Payment } from '../models/index.js'
import { engineFilter } from '../domain/access.js'
import { SCOPE_LEVEL } from '../domain/roles.js'
import type { Scope } from '../interfaces/index.js'

export interface SearchHit {
  kind: 'BOOKING' | 'CUSTOMER' | 'PAYMENT' | 'TRANSACTION'
  id: string
  label: string
  sublabel: string
}

const OPERATIONS: Scope['role'][] = [
  'AGENT',
  'CHIEF_CAPTAIN',
  'SUPERVISOR',
  'MANAGER',
  'PROJECT_MANAGER',
  'TENANT_ADMIN',
]
const FINANCE: Scope['role'][] = ['ACCOUNTANT', 'TENANT_ADMIN']

function safeRegex(query: string): RegExp {
  return new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

export function canSearch(role: Scope['role']): boolean {
  return OPERATIONS.includes(role) || FINANCE.includes(role)
}

export async function search(scope: Scope, query: string, limit = 6): Promise<SearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const rx = safeRegex(q)

  const hits: SearchHit[] = []
  const stationBound = SCOPE_LEVEL[scope.role] === 'kiosk'
  const base: Record<string, unknown> = { tenantId: scope.tenantId }
  if (stationBound) base.stationId = scope.stationId

  if (OPERATIONS.includes(scope.role)) {
    const engines = engineFilter(scope)
    const [bookings, customers] = await Promise.all([
      Booking.find({
        ...base,
        ...(engines === undefined ? {} : { engineKind: engines }),
        $or: [{ ref: rx }, { _id: rx }, { customerName: rx }, { customerPhone: rx }],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Customer.find({ tenantId: scope.tenantId, $or: [{ name: rx }, { phone: rx }] })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ])

    for (const b of bookings) {
      hits.push({
        kind: 'BOOKING',
        id: b._id,
        label: b.ref,
        sublabel: `${b.customerName || 'No customer'} · ${b.status.replaceAll('_', ' ').toLowerCase()}`,
      })
    }
    for (const c of customers) {
      hits.push({ kind: 'CUSTOMER', id: c._id, label: c.name, sublabel: c.phone })
    }
  }

  if (FINANCE.includes(scope.role)) {
    const [payments, transactions] = await Promise.all([
      Payment.find({ tenantId: scope.tenantId, $or: [{ _id: rx }, { orderId: rx }, { bookingId: rx }] })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      CardTransaction.find({ tenantId: scope.tenantId, $or: [{ _id: rx }, { externalRef: rx }, { authCode: rx }, { maskedPan: rx }] })
        .sort({ capturedAt: -1 })
        .limit(limit)
        .lean(),
    ])

    for (const p of payments) {
      hits.push({
        kind: 'PAYMENT',
        id: p._id,
        label: p._id,
        sublabel: `${p.amount.toFixed(2)} SAR · ${p.kind.toLowerCase()} · ${p.method.toLowerCase()}`,
      })
    }
    for (const t of transactions) {
      hits.push({
        kind: 'TRANSACTION',
        id: t._id,
        label: t.externalRef || t._id,
        sublabel: `${t.grossAmount.toFixed(2)} SAR · ${t.scheme}`,
      })
    }
  }

  return hits.slice(0, limit * 2)
}
