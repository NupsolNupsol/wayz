import type { EngineKind } from '@/types'

export interface EngineMeta {
  label: string
  short: string
  tagline: string
  icon: 'ShoppingBag' | 'Bike' | 'Sailboat' | 'UtensilsCrossed' | 'Rabbit'
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

export const VISIBLE_ENGINES: EngineKind[] = ['SHOP_AND_DROP', 'MOBILITY', 'LAGOON']

export const enginesFor = (assigned: EngineKind[]): EngineKind[] =>
  VISIBLE_ENGINES.filter((kind) => assigned.includes(kind))

export const engineLabel = (kind: EngineKind | string): string =>
  ENGINE_META[kind as EngineKind]?.label ?? String(kind)
