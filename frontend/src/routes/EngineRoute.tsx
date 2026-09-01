import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/auth'
import type { EngineKind } from '@/models'

/**
 * An agent is dedicated to specific activities, so the workspaces for the others are
 * closed to them even if they type the address by hand.
 */
export function EngineRoute({ engineKind, children }: { engineKind: EngineKind; children: ReactNode }) {
  const me = useAuthStore((s) => s.me)
  const assigned = me?.engineKinds ?? []

  if (assigned.length && !assigned.includes(engineKind)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
