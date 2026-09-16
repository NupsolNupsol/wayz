import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { useAuthStore } from '@/store/auth'
import { useTenantBrand } from '@/store/tenant'

/**
 * Mounted once, above every route. Keeps the frame honest about whose session this is.
 *
 * **Whose colours are these?** The signed-in organisation's, or the platform's when nobody is
 * signed in. Decided by the session — see `store/tenant.ts` for why it is no longer decided
 * by the address.
 *
 * What used to live here as well was a guard against carrying one organisation's session onto
 * another organisation's address. There are no such addresses now: one neutral door, and the
 * account decides where you land. The guard had nothing left to guard.
 */
export function TenantChrome() {
  const me = useAuthStore((s) => s.me)

  useTenantBrand({
    organizationId: me?.tenant?.id ?? null,
    branding: me?.tenant?.branding ?? null,
  })

  /*
   * The browser tab names the organisation you are in.
   *
   * It said "WAYZ · Agent POS" for everybody, so somebody with two workspaces open had two
   * identical tabs, one of them lying about which company it held.
   */
  useEffect(() => {
    const company = me?.tenant?.name
    document.title = company ? `${company} · LockerFlow` : 'LockerFlow'
  }, [me?.tenant?.name])

  return <Outlet />
}
