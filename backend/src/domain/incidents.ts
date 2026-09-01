import type { EngineKind } from './types.js'

export const INCIDENT_TYPES = [
  'MISSING_BAG',
  'DAMAGED_BAG',
  'WRONG_BAG',
  'LABEL_ISSUE',
  'DAMAGE_ON_RETURN',
  'ASSET_DAMAGE',
  'ASSET_FAULT',
  'ASSET_NOT_RETURNED',
  'LATE_RETURN',
  'CUSTOMER_INJURY',
  'SAFETY_CONCERN',
  'ANIMAL_WELFARE',
  'FOOD_QUALITY',
  'ORDER_ERROR',
  'ACCESS_ISSUE',
  'PAYMENT_DISPUTE',
  'OTHER',
] as const

export type IncidentType = (typeof INCIDENT_TYPES)[number]

export const INCIDENT_CATALOGUE: Record<EngineKind, IncidentType[]> = {
  SHOP_AND_DROP: [
    'MISSING_BAG',
    'DAMAGED_BAG',
    'WRONG_BAG',
    'LABEL_ISSUE',
    'DAMAGE_ON_RETURN',
    'ACCESS_ISSUE',
    'LATE_RETURN',
    'PAYMENT_DISPUTE',
    'OTHER',
  ],
  MOBILITY: [
    'ASSET_FAULT',
    'ASSET_DAMAGE',
    'LATE_RETURN',
    'ASSET_NOT_RETURNED',
    'CUSTOMER_INJURY',
    'SAFETY_CONCERN',
    'ACCESS_ISSUE',
    'PAYMENT_DISPUTE',
    'OTHER',
  ],
  LAGOON: ['ASSET_FAULT', 'ASSET_DAMAGE', 'SAFETY_CONCERN', 'CUSTOMER_INJURY', 'LATE_RETURN', 'PAYMENT_DISPUTE', 'OTHER'],
  COTE_RESTAURANT: ['ORDER_ERROR', 'FOOD_QUALITY', 'PAYMENT_DISPUTE', 'CUSTOMER_INJURY', 'OTHER'],
  ANAAM: ['ANIMAL_WELFARE', 'SAFETY_CONCERN', 'CUSTOMER_INJURY', 'ASSET_FAULT', 'PAYMENT_DISPUTE', 'OTHER'],
}

export function incidentTypesFor(engineKind?: EngineKind | null): IncidentType[] {
  if (engineKind && INCIDENT_CATALOGUE[engineKind]) return INCIDENT_CATALOGUE[engineKind]
  const seen = new Set<IncidentType>()
  for (const list of Object.values(INCIDENT_CATALOGUE)) for (const t of list) seen.add(t)
  return INCIDENT_TYPES.filter((t) => seen.has(t))
}

export function isIncidentTypeValidFor(engineKind: EngineKind | null | undefined, type: IncidentType): boolean {
  return incidentTypesFor(engineKind).includes(type)
}
