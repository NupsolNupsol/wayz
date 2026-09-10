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

export function enginesFor(assigned: EngineKind[]): EngineKind[] {
  return assigned.length ? VISIBLE_ENGINES.filter((k) => assigned.includes(k)) : VISIBLE_ENGINES
}

export function engineOptionsFor(assigned: EngineKind[]) {
  return enginesFor(assigned).map((k) => ({ label: engineLabel(k), value: k }))
}

/**
 * The icons a product can be given. They are drawn, not typed: an emoji renders differently on
 * every device and reads as a stand-in rather than a considered choice.
 */
export const PRODUCT_ICONS = [
  'Package', 'ShoppingBag', 'Boxes', 'PackageOpen', 'Bike', 'Car', 'Accessibility', 'Baby',
  'ShoppingCart', 'Sailboat', 'Ship', 'Anchor', 'Truck', 'UtensilsCrossed', 'Coffee', 'Beef',
  'Salad', 'GlassWater', 'Rabbit', 'Bird', 'Tag', 'Sparkles',
] as const

/**
 * What to draw on a product tile: the icon the company chose, or one worked out from the name.
 * A value that is not one of ours (an emoji from an older catalogue) is ignored rather than shown.
 */
export function productIconFor(
  product: { name: string; emoji?: string | null },
  engineKind: EngineKind,
): string {
  const chosen = (product.emoji ?? '').trim()
  if (chosen && (PRODUCT_ICONS as readonly string[]).includes(chosen)) return chosen
  return productIcon(product.name, engineKind)
}

/**
 * What each activity is sold by, and whether time is charged for at all. Kept beside the labels so
 * a form never offers a unit the API will refuse — a trip is sold as a trip.
 */
export const SALE_UNITS_FOR: Partial<Record<EngineKind, string[]>> = {
  SHOP_AND_DROP: ['HOUR', 'FULL_DAY', 'BAG', 'CART', 'DELIVERY', 'ITEM'],
  MOBILITY: ['HOUR', 'FULL_DAY', 'TOUR', 'ITEM'],
  LAGOON: ['TOUR'],
}

export function saleUnitsFor(engineKind: EngineKind, all: readonly string[]): string[] {
  return SALE_UNITS_FOR[engineKind] ?? [...all]
}

/**
 * What an activity is sold by unless somebody deliberately changes it.
 *
 * Storage and hire are both time: a compartment held for four hours costs four hours, and a
 * scooter out all afternoon costs the afternoon. Defaulting them to anything else means every new
 * kind starts out charging a flat fee and the first long stay is undercharged before anyone
 * notices. A lagoon trip is a trip, so it defaults to one.
 */
export const DEFAULT_SALE_UNIT: Partial<Record<EngineKind, string>> = {
  SHOP_AND_DROP: 'HOUR',
  MOBILITY: 'HOUR',
  LAGOON: 'TOUR',
}

export function defaultSaleUnitFor(engineKind: EngineKind, all: readonly string[]): string {
  const offered = saleUnitsFor(engineKind, all)
  const wanted = DEFAULT_SALE_UNIT[engineKind]
  return wanted && offered.includes(wanted) ? wanted : (offered[0] ?? 'ITEM')
}

/** Sale units that measure time — mirrors the platform's own rule. */
export const TIMED_SALE_UNITS = ['HOUR', 'FULL_DAY']

export const isTimedSaleUnit = (unit: string): boolean => TIMED_SALE_UNITS.includes(unit)

/**
 * How a kind sold in this unit will actually be charged.
 *
 * The form does not ask for a billing model — it is decided by how the thing is sold — so this is
 * what the platform will do, shown back to the admin before they commit to it.
 */
export function billingForSaleUnit(unit: string, kind: string): string {
  if (isTimedSaleUnit(unit)) return 'DURATION_BASED'
  if (kind === 'COMPARTMENT') return 'PER_COMPARTMENT'
  if (kind === 'VEHICLE') return 'DURATION_BASED'
  return 'PACKAGE'
}

/** A lagoon trip has a captain, not a meter, so nothing about it is priced by time. */
export function chargesForTime(engineKind: EngineKind): boolean {
  return engineKind !== 'LAGOON'
}

/** How a charge reads to the person setting it, in the words that activity actually uses. */
export function billingLabel(model: string, engineKind: EngineKind): string {
  if (model === 'PACKAGE') {
    if (engineKind === 'LAGOON') return 'PER TRIP'
    if (engineKind === 'ANAAM') return 'PER EXPERIENCE'
    if (engineKind === 'MOBILITY') return 'PER TOUR'
  }
  return model.replaceAll('_', ' ')
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
