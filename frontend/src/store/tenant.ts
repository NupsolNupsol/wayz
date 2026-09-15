import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { authApi, type TenantFront } from '@/api/auth.api'
import { applyTenantBranding, PLATFORM_BRAND, type BrandColours } from './branding'

/**
 * Whose page this is — decided in one place, from the address.
 *
 * This module exists because the answer used to be scattered and inconsistent. The login page
 * knew its tenant from a route parameter, the app knew its tenant from the session, and the
 * sign-out handler knew nothing and simply tore the colours down. Those three answers
 * disagreed at exactly the moments the client hit: a failed sign-in reset a tenant's brand to
 * the platform's, and moving between tenants left the previous one's colours behind.
 *
 * The rule now: **the address decides, and the session only fills in what the address leaves
 * unsaid.** A tenant's own routes name their tenant, so those are unambiguous even when signed
 * out. The control plane's routes name no tenant and never wear one. Everything else belongs
 * to whoever is signed in, and to nobody when nobody is.
 */

/** The handle in the address, when the address belongs to a tenant. */
export function tenantSlugFromPath(pathname: string): string | null {
  const match = /^\/t\/([a-z0-9-]{2,32})(?:\/|$)/i.exec(pathname)
  return match ? match[1].toLowerCase() : null
}

/** The control plane sits above every tenant and wears none of their colours. */
export function isPlatformPath(pathname: string): boolean {
  return pathname === '/platform' || pathname.startsWith('/platform/')
}

/** The platform's own neutral doors: no tenant, by definition. */
export function isNeutralPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/login' || isPlatformPath(pathname)
}

/**
 * The tenant an address belongs to, or null if it belongs to none.
 *
 * `signedInTo` is the handle on the current session. It is consulted only where the address
 * itself is silent, and never on a neutral path — which is what stops a signed-in WAYZ user
 * from making the platform's own front door turquoise.
 */
export function resolveTenant(pathname: string, signedInTo: string | null | undefined): string | null {
  const fromPath = tenantSlugFromPath(pathname)
  if (fromPath) return fromPath
  if (isNeutralPath(pathname)) return null
  return signedInTo ?? null
}

/* The last brand painted, so an unchanged answer does not repaint on every navigation. */
const PLATFORM = '\u0000platform'
let painted: string | null = null
const fronts = new Map<string, TenantFront>()
const inFlight = new Map<string, Promise<TenantFront | null>>()

/**
 * A tenant's public face, fetched once per handle and remembered for the session.
 *
 * Both the sign-in page and the route's brand painter want this at the same moment, and
 * React's strict mode runs each of them twice — which was three identical requests for the
 * same handle on every page load. Sharing the promise as well as the result means the first
 * caller does the work and everybody else waits for it.
 */
export async function tenantFront(slug: string): Promise<TenantFront | null> {
  const cached = fronts.get(slug)
  if (cached) return cached

  const running = inFlight.get(slug)
  if (running) return running

  const request = authApi
    .tenantFront(slug)
    .then((front) => {
      fronts.set(slug, front)
      return front
    })
    .catch(() => null)
    .finally(() => inFlight.delete(slug))

  inFlight.set(slug, request)
  return request
}

/** Forget a handle's cached face — after a super admin changes its branding, for instance. */
export function forgetTenantFront(slug?: string): void {
  if (slug) {
    fronts.delete(slug)
    inFlight.delete(slug)
  } else {
    fronts.clear()
    inFlight.clear()
  }
}

/**
 * Paints the resolved tenant's colours, or the platform's own when there is no tenant.
 *
 * Idempotent: asking for the brand already showing does nothing, so this is safe to call on
 * every render and every navigation.
 */
export async function paintBrandFor(slug: string | null, known?: Partial<BrandColours> | null): Promise<void> {
  if (slug === null) {
    /*
     * No tenant means the platform's own colours, not the absence of colour.
     *
     * Resetting to the stylesheet default stopped being safe the moment a tenant was given
     * that same default as its identity: the platform's gateway and that customer's workspace
     * would then be indistinguishable. The control plane wears something of its own.
     */
    if (painted !== PLATFORM) {
      applyTenantBranding(PLATFORM_BRAND)
      painted = PLATFORM
    }
    return
  }

  if (painted === slug && !known) return

  const branding = known ?? (await tenantFront(slug))?.branding ?? null

  /*
   * A handle nobody recognises leaves the platform's palette alone rather than half-applying
   * something. Painting a guess would be worse than painting nothing.
   */
  if (!branding) {
    if (painted !== PLATFORM) {
      applyTenantBranding(PLATFORM_BRAND)
      painted = PLATFORM
    }
    return
  }

  applyTenantBranding(branding)
  painted = slug
}

/** Forget what is on screen — for a sign-out, where the next paint must actually happen. */
export function forgetPaintedBrand(): void {
  painted = null
}

/**
 * Keeps the colours on screen agreeing with the address, on every navigation.
 *
 * Mounted once, above the whole router. Two things follow from it, and both were bugs before:
 * moving from one tenant's door to another's repaints, and leaving for a neutral page strips
 * the tenant's colours instead of leaving them on the platform's own screens.
 *
 * The session is passed in rather than read here, so this module never imports the auth store
 * — the store imports this one, and the dependency stays pointing one way.
 */
export function useTenantBrand(session: {
  slug: string | null | undefined
  branding: Partial<BrandColours> | null | undefined
}): void {
  const { pathname } = useLocation()
  const signedInTo = session.slug ?? null
  const sessionBranding = session.branding ?? null

  useEffect(() => {
    const slug = resolveTenant(pathname, signedInTo)

    /*
     * A signed-in user's own branding travels with the session, so their pages paint from the
     * first frame with no request. A tenant door reached while signed out has to ask.
     */
    const known = slug && slug === signedInTo ? sessionBranding : null
    void paintBrandFor(slug, known)
  }, [pathname, signedInTo, sessionBranding])
}
