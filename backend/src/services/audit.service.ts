import { AsyncLocalStorage } from 'node:async_hooks'
import { Audit } from '../models/index.js'
import { logger } from '../config/logger.js'

export interface AuditEntry {
  tenantId: string
  actorId: string
  action: string
  entity: string
  entityId: string
  reason?: string
  detail?: string
}

const perRequest = new AsyncLocalStorage<{ written: boolean }>()

export function inAuditContext<T>(fn: () => T): T {
  return perRequest.run({ written: false }, fn)
}

export function auditAlreadyWritten(): boolean {
  return perRequest.getStore()?.written ?? false
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await Audit.create(entry)
    const ctx = perRequest.getStore()
    if (ctx) ctx.written = true
  } catch (err) {
    logger.warn('Audit not recorded', { action: entry.action, error: (err as Error).message })
  }
}
