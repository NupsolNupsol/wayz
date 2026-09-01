import i18n from '@/i18n'
import type { EngineKind } from '@/api/types'

export interface EngineMeta {
  label: string
  tagline: string
  icon: string
  route: string
}

export const ENGINE_META: Record<EngineKind, EngineMeta> = {
  SHOP_AND_DROP: { label: 'Shop & Drop', tagline: 'Bag storage & retrieval', icon: 'ShoppingBag', route: '/shop-drop' },
  MOBILITY: { label: 'Mobility Rentals', tagline: 'Scooters, carts, wheelchairs & more', icon: 'Bike', route: '/mobility' },
  LAGOON: { label: 'Lagoon', tagline: 'Boat activities & dispatch', icon: 'Sailboat', route: '/lagoon' },
  COTE_RESTAURANT: { label: 'COTE Restaurant', tagline: 'Dining & kitchen display', icon: 'UtensilsCrossed', route: '/cote' },
  ANAAM: { label: "Ana'am Experience", tagline: 'Animal experiences', icon: 'Rabbit', route: '/anaam' },
}

/** The activity's name in the reader's language; the table above holds the English fallback. */
export function engineLabel(kind: EngineKind | string): string {
  return i18n.t(`common:engine.${kind}`, { defaultValue: ENGINE_META[kind as EngineKind]?.label ?? String(kind) })
}

export function engineTagline(kind: EngineKind): string {
  return i18n.t(`common:engineTagline.${kind}`, { defaultValue: ENGINE_META[kind]?.tagline ?? '' })
}

export const VISIBLE_ENGINES: EngineKind[] = ['SHOP_AND_DROP', 'MOBILITY', 'LAGOON']

export function isVisibleEngine(kind: EngineKind): boolean {
  return VISIBLE_ENGINES.includes(kind)
}

export const visibleEngineOptions = () => VISIBLE_ENGINES.map((k) => ({ label: engineLabel(k), value: k }))

/**
 * An agent is dedicated to specific activities; every other role passes an empty list
 * and sees them all.
 */
export function enginesFor(assigned: EngineKind[]): EngineKind[] {
  return assigned.length ? VISIBLE_ENGINES.filter((k) => assigned.includes(k)) : VISIBLE_ENGINES
}

export function engineOptionsFor(assigned: EngineKind[]) {
  return enginesFor(assigned).map((k) => ({ label: engineLabel(k), value: k }))
}

export function productIcon(name: string, engineKind: EngineKind): string {
  const n = name.toLowerCase()
  if (n.includes('scooter')) return 'Bike'
  if (n.includes('wheelchair')) return 'Accessibility'
  if (n.includes('tuk')) return 'Car'
  if (n.includes('stroller')) return 'Baby'
  if (n.includes('cart')) return 'ShoppingCart'
  if (n.includes('kids car') || n.includes('kids')) return 'Car'
  if (n.includes('boat') || n.includes('pedal')) return 'Sailboat'
  if (n.includes('burger') || n.includes('beef')) return 'Beef'
  if (n.includes('salad')) return 'Salad'
  if (n.includes('juice') || n.includes('drink')) return 'GlassWater'
  if (n.includes('kunafa') || n.includes('dessert')) return 'Coffee'
  if (n.includes('pony') || n.includes('horse')) return 'Rabbit'
  if (n.includes('falcon') || n.includes('bird')) return 'Bird'
  if (n.includes('family') || n.includes('pack')) return 'Boxes'
  if (engineKind === 'SHOP_AND_DROP') return 'Package'
  return ENGINE_META[engineKind].icon
}
