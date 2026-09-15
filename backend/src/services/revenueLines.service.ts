import { ActivityDefinition } from '../models/index.js'
import type { ActivityDefinitionDoc } from '../models/index.js'
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js'
import { ACTIVITY_LABELS } from '../constants/labels.constants.js'
import type { BilingualLabel } from '../interfaces/index.js'

/**
 * The lines a company's money is reported under.
 *
 * Accounting has to group sales by *something*, and what that something is was previously a
 * platform constant: five built-in engines, so every company's VAT statement had a row for
 * Lagoon, a row for Scooters and a row for Shop & Drop whether or not it ran any of them —
 * and every sale a company actually made fell into whichever of those five the code defaulted
 * to. A horse ride was reported as a bag drop.
 *
 * The dimension is now the tenant's own:
 *
 *  - a company that has **defined its own activities** is reported by those activities;
 *  - a company that has **not** is reported by the built-in engines, exactly as before.
 *
 * Both are the same shape, so nothing downstream — the statement, the ledger, the workbook —
 * has to know which kind of company it is looking at.
 */

export interface RevenueLine {
  /** Stable identifier for this line: an activity key, or an engine name. */
  key: string
  /** Set only for a line that is a built-in engine, so existing reports keep their filter. */
  engineKind: EngineKind | null
  label: BilingualLabel
}

/** Where money with no line at all is reported, rather than silently joining somebody else's. */
export const UNATTRIBUTED: RevenueLine = {
  key: 'UNATTRIBUTED',
  engineKind: null,
  label: { en: 'Unattributed', ar: 'غير مصنّف' },
}

/** A row of money, as far as this question is concerned. */
export interface Attributable {
  activityKey?: string | null
  engineKind?: string | null
}

/**
 * Which line a row of money belongs to.
 *
 * The activity wins where both are present, which matters for nothing today and matters a
 * great deal the day a company that ran the built-in engines starts defining its own
 * activities alongside them: the newer, more specific dimension is the truer one.
 */
export const lineKeyOf = (row: Attributable): string =>
  row.activityKey ?? row.engineKind ?? UNATTRIBUTED.key

export async function revenueLines(tenantId: string): Promise<RevenueLine[]> {
  const activities = await ActivityDefinition.find(
    { tenantId, currentRevision: { $gt: 0 } },
    { key: 1, name: 1, nameAr: 1, status: 1 },
  )
    .sort({ name: 1 })
    .lean<Pick<ActivityDefinitionDoc, 'key' | 'name' | 'nameAr' | 'status'>[]>()

  /*
   * Archived activities are still lines.
   *
   * Everything sold under one stays on the books, and a statement that dropped the row would
   * lose the money rather than the activity. Which is why this asks for anything ever
   * published, not anything currently published.
   */
  if (activities.length > 0) {
    return activities.map((a) => ({
      key: a.key,
      engineKind: null,
      label: { en: a.name, ar: a.nameAr || a.name },
    }))
  }

  return ENGINE_KINDS.map((engineKind) => ({
    key: engineKind,
    engineKind,
    label: ACTIVITY_LABELS[engineKind],
  }))
}

/** The same lines, keyed for lookup, with the unattributed line always available. */
export async function revenueLineIndex(tenantId: string): Promise<Map<string, RevenueLine>> {
  const lines = await revenueLines(tenantId)
  return new Map([...lines, UNATTRIBUTED].map((l) => [l.key, l]))
}
