import { Notification } from '../models/index.js'
import { SCOPE_LEVEL } from '../domain/roles.js'
import { allowedEngines } from '../domain/access.js'
import { ApiError } from '../utils/ApiError.js'
import type { NotificationLevel } from '../models/notification.model.js'
import type { EngineKind, Role } from '../domain/types.js'
import type { Scope } from '../interfaces/index.js'

export interface RaiseNotification {
  tenantId: string
  stationId?: string
  kioskId?: string | null
  engineKind?: EngineKind | null
  title: string
  body?: string
  level?: NotificationLevel
  audience?: Role[]
  link?: string | null
}

export async function raise(input: RaiseNotification) {
  return Notification.create({
    tenantId: input.tenantId,
    stationId: input.stationId ?? '',
    kioskId: input.kioskId ?? null,
    engineKind: input.engineKind ?? null,
    title: input.title,
    body: input.body ?? '',
    level: input.level ?? 'info',
    audience: input.audience ?? [],
    link: input.link ?? null,
  })
}

function visibleTo(scope: Scope): Record<string, unknown> {
  const q: Record<string, unknown> = { tenantId: scope.tenantId }

  const level = SCOPE_LEVEL[scope.role]
  if (level === 'kiosk') {
    q.stationId = { $in: [scope.stationId, ''] }
    q.$and = [{ $or: [{ kioskId: null }, { kioskId: scope.kioskId ?? '' }] }]
  }

  const engines = allowedEngines(scope)
  if (engines !== null) {
    const engineClause = { $or: [{ engineKind: null }, { engineKind: { $in: engines } }] }
    q.$and = [...((q.$and as object[]) ?? []), engineClause]
  }

  q.$and = [...((q.$and as object[]) ?? []), { $or: [{ audience: [] }, { audience: scope.role }] }]
  return q
}

export interface NotificationFilter {
  unreadOnly?: boolean
  limit?: number
}

export async function listNotifications(scope: Scope, filter: NotificationFilter = {}) {
  const q = visibleTo(scope)
  if (filter.unreadOnly) q.readBy = { $ne: scope.agentId }

  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200)
  const rows = await Notification.find(q).sort({ createdAt: -1 }).limit(limit).lean()

  return rows.map((n) => ({
    _id: n._id,
    title: n.title,
    body: n.body,
    level: n.level,
    link: n.link ?? null,
    engineKind: n.engineKind ?? null,
    stationId: n.stationId || null,
    createdAt: n.createdAt,
    read: (n.readBy ?? []).includes(scope.agentId),
  }))
}

export async function unreadCount(scope: Scope): Promise<number> {
  return Notification.countDocuments({ ...visibleTo(scope), readBy: { $ne: scope.agentId } })
}

export async function markRead(scope: Scope, id: string) {
  const notification = await Notification.findOne({ _id: id, ...visibleTo(scope) })
  if (!notification) throw ApiError.notFound('Notification not found.')
  await Notification.updateOne({ _id: id }, { $addToSet: { readBy: scope.agentId } })
  return { ok: true }
}

export async function markAllRead(scope: Scope) {
  const result = await Notification.updateMany(
    { ...visibleTo(scope), readBy: { $ne: scope.agentId } },
    { $addToSet: { readBy: scope.agentId } },
  )
  return { ok: true, cleared: result.modifiedCount ?? 0 }
}
