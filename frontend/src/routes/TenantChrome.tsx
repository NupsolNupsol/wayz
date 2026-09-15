import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/store/auth'
import { tenantSlugFromPath, useTenantBrand } from '@/store/tenant'

/**
 * Mounted once, above every route. Answers two questions the app kept getting wrong.
 *
 * **Whose colours are these?** Handled by `useTenantBrand`, which resolves the tenant from the
 * address on every navigation. See `store/tenant.ts` for why the address decides and the
 * session does not.
 *
 * **Whose session is this?** Answered here, because it is a routing concern. An address of the
 * form `/t/<handle>/…` names a tenant out loud, and a session belonging to a different tenant
 * has no business on it. Carrying one across would be the worst kind of multi-tenancy bug:
 * one company's staff looking at a page addressed to another, with whatever was already
 * cached still on screen.
 */
export function TenantChrome() {
  const location = useLocation()
  const navigate = useNavigate()

  const me = useAuthStore((s) => s.me)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)

  useTenantBrand({ slug: me?.tenant?.slug ?? null, branding: me?.tenant?.branding ?? null })

  /*
   * The browser tab names the company you are in.
   *
   * It said "WAYZ · Agent POS" for every tenant, so somebody with two workspaces open had two
   * identical tabs, one of them lying about which company it held.
   */
  useEffect(() => {
    const company = me?.tenant?.name
    document.title = company ? `${company} · LockerFlow` : 'LockerFlow'
  }, [me?.tenant?.name])

  useEffect(() => {
    const addressed = tenantSlugFromPath(location.pathname)
    if (!addressed || !token) return

    const session = me?.tenant?.slug ?? null
    if (session && session !== addressed) {
      /*
       * The address names one tenant and the session belongs to another.
       *
       * Ending the session is the only safe answer. Anything softer — a warning, a redirect
       * that keeps the token — leaves a live credential for company A on a page addressed to
       * company B, which is precisely the state a multi-tenant product must never reach.
       * Cached answers from the old tenant go with it.
       */
      logout()
      navigate(`/t/${addressed}/login`, { replace: true })
    }
  }, [location.pathname, token, me?.tenant?.slug, logout, navigate])

  return <Outlet />
}
