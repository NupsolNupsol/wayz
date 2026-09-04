import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/auth'
import { can } from '@/permissions/permissions'
import type { EngineKind } from '@/models'

export function EngineRoute({ engineKind, children }: { engineKind: EngineKind; children: ReactNode }) {
  const me = useAuthStore((s) => s.me)
  const assigned = me?.engineKinds ?? []

  if (!can(me?.role, 'pos.use')) return <Navigate to="/dashboard" replace />
  if (assigned.length && !assigned.includes(engineKind)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
