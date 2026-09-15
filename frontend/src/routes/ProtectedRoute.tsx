import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useMe } from '@/hooks'
import { AGENT_ROLES, homeForRole } from '@/permissions/permissions'

export function ProtectedRoute({ children, allow = AGENT_ROLES }: { children: ReactNode; allow?: string[] }) {
  const token = useAuthStore((s) => s.token)
  const me = useAuthStore((s) => s.me)
  const setMe = useAuthStore((s) => s.setMe)
  const meQuery = useMe(!!token && !me)

  useEffect(() => {
    if (meQuery.data) setMe(meQuery.data)
  }, [meQuery.data, setMe])

  /*
   * Back to a door — theirs if we know which one.
   *
   * A session that has expired still tells us which company the person works for, and sending
   * them to the platform's neutral gateway to pick their own employer again is a worse
   * experience than returning them to the page they signed in on. When there is no session at
   * all to ask, the gateway is the honest answer.
   */
  const door = me?.tenant?.slug ? `/t/${me.tenant.slug}/login` : '/login'

  if (!token) return <Navigate to={door} replace />

  const role = me?.role ?? meQuery.data?.role
  if (!role) {
    if (meQuery.isError) return <Navigate to={door} replace />
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        <Loader2 className="animate-spin" />
      </div>
    )
  }
  if (!allow.includes(role)) return <Navigate to={homeForRole(role)} replace />
  return <>{children}</>
}
