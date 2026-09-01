import type { EngineKind } from '@/types'

export interface EngineMeta {
  label: string
  short: string
  tagline: string
  icon: 'ShoppingBag' | 'Bike' | 'Sailboat' | 'UtensilsCrossed' | 'Rabbit'
  /** Which wizard sells it: bags need packing, everything else is a straight rental. */
  flow: 'bags' | 'rental'
  route: '/new/shop-drop' | '/new/rental'
}

export const ENGINE_META: Record<EngineKind, EngineMeta> = {
  SHOP_AND_DROP: {
    label: 'Shop & Drop',
    short: 'Bags',
    tagline: 'Bag storage & retrieval',
    icon: 'ShoppingBag',
    flow: 'bags',
    route: '/new/shop-drop',
  },
  MOBILITY: {
    label: 'Mobility Rentals',
    short: 'Mobility',
    tagline: 'Scooters, carts, wheelchairs',
    icon: 'Bike',
    flow: 'rental',
    route: '/new/rental',
  },
  LAGOON: {
    label: 'Lagoon',
    short: 'Lagoon',
    tagline: 'Boat activities & dispatch',
    icon: 'Sailboat',
    flow: 'rental',
    route: '/new/rental',
  },
  COTE_RESTAURANT: {
    label: 'COTE Restaurant',
    short: 'COTE',
    tagline: 'Dining & kitchen display',
    icon: 'UtensilsCrossed',
    flow: 'rental',
    route: '/new/rental',
  },
  ANAAM: {
    label: "Ana'am Experience",
    short: "Ana'am",
    tagline: 'Animal experiences',
    icon: 'Rabbit',
    flow: 'rental',
    route: '/new/rental',
  },
}

/** The three activities this tenant actually runs. */
export const VISIBLE_ENGINES: EngineKind[] = ['SHOP_AND_DROP', 'MOBILITY', 'LAGOON']

/**
 * An agent is dedicated to specific activities and must not be offered the others. An empty
 * assignment means the account was set up wrong, so it grants nothing rather than everything.
 */
export const enginesFor = (assigned: EngineKind[]): EngineKind[] =>
  VISIBLE_ENGINES.filter((kind) => assigned.includes(kind))

export const engineLabel = (kind: EngineKind | string): string =>
  ENGINE_META[kind as EngineKind]?.label ?? String(kind)
