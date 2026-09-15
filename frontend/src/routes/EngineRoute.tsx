import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/auth'
import { can } from '@/permissions/permissions'
import type { EngineKind } from '@/models'

/**
 * Guards a screen built around one of the platform's built-in activities.
 *
 * Two questions, and the order matters. **Does this company run it at all?** — asked first,
 * because a company that does not has no business reaching the screen however senior the
 * person is. Then **is this person assigned to it?** — the narrower question, and the one this
 * guard originally asked on its own.
 *
 * Asking only the second was a leak. "Assigned to nothing" was read as "assigned to
 * everything", which is right for a WAYZ supervisor who works all three and catastrophic for a
 * WIQAR horse trainer who works none of them: they were let straight into Shop & Drop by
 * typing its address, and shown another company's business.
 */
export function EngineRoute({ engineKind, children }: { engineKind: EngineKind; children: ReactNode }) {
  const me = useAuthStore((s) => s.me)
  const runByThisCompany = me?.tenant?.enabledEngines ?? []
  const assigned = me?.engineKinds ?? []

  if (!can(me?.role, 'pos.use')) return <Navigate to="/dashboard" replace />
  if (!runByThisCompany.includes(engineKind)) return <Navigate to="/dashboard" replace />
  if (assigned.length && !assigned.includes(engineKind)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
