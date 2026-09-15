/**
 * A tenant's colours, applied to the design tokens the whole app already draws from.
 *
 * Every branded surface — the sidebar, a primary button, a link, an active nav item, a badge
 * — resolves its colour from `--brand` and its neighbours. So changing a tenant's brand is
 * not a change to any component: it is a change to four custom properties on the root
 * element, and the application follows because it was always reading them.
 *
 * That is what makes branding configuration rather than code. A super admin saves a colour,
 * the tenant's next page load wears it, and nothing was rebuilt or redeployed.
 */

export interface BrandColours {
  primaryColor: string
  secondaryColor: string
  accentColor: string
}

/** `#1a3470` → `26 52 112`, which is the shape the tokens are written in for rgb(var(--x) / a). */
function channels(hex: string): string | null {
  const value = hex.trim()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value)
  const full = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value)

  const parts = short
    ? [short[1] + short[1], short[2] + short[2], short[3] + short[3]]
    : full
      ? [full[1], full[2], full[3]]
      : null

  return parts ? parts.map((p) => parseInt(p, 16)).join(' ') : null
}

/** Mixes towards black or white, for the darker hovers and the pale tint the tokens expect. */
function shift(rgb: string, amount: number): string {
  const [r, g, b] = rgb.split(' ').map(Number)
  const towards = amount < 0 ? 0 : 255
  const t = Math.abs(amount)
  return [r, g, b].map((c) => Math.round(c + (towards - c) * t)).join(' ')
}

/**
 * Whether white or near-black text is legible on this colour.
 *
 * A tenant can choose a pale brand, and a primary button with white text on pale yellow is
 * unreadable. Relative luminance decides it, so the choice is made by contrast rather than by
 * hoping every tenant picks something dark.
 */
function readableInk(rgb: string): string {
  const [r, g, b] = rgb.split(' ').map((n) => Number(n) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.55 ? '15 39 64' : '255 255 255'
}

/**
 * The control plane's own colours.
 *
 * The platform needs a palette that is nobody's tenant. Its default used to be whatever the
 * stylesheet said, which was fine until WAYZ's own identity was restored to that same teal —
 * at which point the platform's front door and one customer's workspace would have looked
 * identical, and an operator with both open could not tell them apart at a glance.
 *
 * Indigo, chosen because no tenant is likely to pick it and it reads as infrastructure rather
 * than as a brand.
 */
export const PLATFORM_BRAND: BrandColours = {
  primaryColor: '#4f46e5',
  secondaryColor: '#3730a3',
  accentColor: '#0ea5e9',
}

export function applyTenantBranding(brand: Partial<BrandColours> | null | undefined): void {
  const root = document.documentElement
  const primary = brand?.primaryColor ? channels(brand.primaryColor) : null

  // An unbranded tenant, or a colour that is not one, leaves the platform's own palette in
  // place rather than half-applying something.
  if (!primary) {
    resetTenantBranding()
    return
  }

  root.style.setProperty('--brand', primary)
  root.style.setProperty('--brand-600', shift(primary, -0.12))
  root.style.setProperty('--brand-700', shift(primary, -0.24))
  root.style.setProperty('--brand-50', shift(primary, 0.9))
  root.style.setProperty('--brand-fg', readableInk(primary))

  const secondary = brand?.secondaryColor ? channels(brand.secondaryColor) : null
  if (secondary) root.style.setProperty('--secondary', secondary)

  const accent = brand?.accentColor ? channels(brand.accentColor) : null
  if (accent) root.style.setProperty('--switch', accent)
}

/** Back to the platform's own palette — for signing out, and for the platform's own screens. */
export function resetTenantBranding(): void {
  const root = document.documentElement
  for (const token of ['--brand', '--brand-600', '--brand-700', '--brand-50', '--brand-fg', '--secondary', '--switch']) {
    root.style.removeProperty(token)
  }
}
