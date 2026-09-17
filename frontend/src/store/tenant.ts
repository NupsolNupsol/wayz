import { useEffect } from 'react';

import { applyTenantBranding, PLATFORM_BRAND, type BrandColours } from './branding';

/**
 * Whose colours the product is wearing — decided by the session, and by nothing else.
 *
 * This module used to answer that from the **address**, because each organisation had a
 * sign-in page of its own at `/t/<handle>/login` and a person had to be shown the right brand
 * before they had typed anything. That made the address authoritative, the session
 * subordinate, and the two disagreed at exactly the moments that were reported as bugs: a
 * failed sign-in repainted an organisation's door in the platform's palette, and moving
 * between organisations left the previous one's colours behind.
 *
 * There is one neutral door now. Before signing in the product does not know whose employee is
 * at it, so it wears the platform's own palette and says so. After signing in the session
 * carries the organisation, and the organisation carries the brand. One source, no race, and
 * nothing to fetch — the colours arrive with the session that decided them.
 */

/** What is currently painted, so an unchanged brand is not reapplied on every navigation. */
const PLATFORM = '__platform__';
let painted: string | null = null;

/**
 * Paints an organisation's colours, or the platform's when there is no session.
 *
 * `branding` comes from `/auth/me`, so there is no request to make and no frame in which the
 * wrong brand could show.
 */
export function paintBrandFor(
  organizationId: string | null,
  branding?: Partial<BrandColours> | null
): void {
  if (!organizationId || !branding) {
    /*
     * No organisation means the platform's own colours, not the absence of colour.
     *
     * Resetting to the stylesheet default stopped being safe the moment an organisation was
     * given that same default as its identity: the neutral door and that customer's workspace
     * would then be indistinguishable.
     */
    if (painted !== PLATFORM) {
      applyTenantBranding(PLATFORM_BRAND);
      painted = PLATFORM;
    }
    return;
  }

  if (painted === organizationId) return;

  applyTenantBranding(branding);
  painted = organizationId;
}

/** Forget what is on screen — for a sign-out, where the next paint must actually happen. */
export function forgetPaintedBrand(): void {
  painted = null;
}

/**
 * Keeps the screen wearing the signed-in organisation's colours.
 *
 * Mounted once, above every route. It does not look at the address at all: there is no address
 * that belongs to an organisation any more.
 */
export function useTenantBrand(session: {
  organizationId: string | null | undefined;
  branding: Partial<BrandColours> | null | undefined;
}): void {
  const organizationId = session.organizationId ?? null;
  const branding = session.branding ?? null;

  useEffect(() => {
    paintBrandFor(organizationId, branding);
  }, [organizationId, branding]);
}
