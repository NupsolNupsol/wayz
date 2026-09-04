import { Anchor, Bike, Building2, PackageOpen, UtensilsCrossed } from 'lucide-react'
import type { MapPoint } from './StationMap'

const TONE: Record<string, string> = {
  LAGOON: 'bg-sky-500',
  SHOP_AND_DROP: 'bg-brand',
  MOBILITY: 'bg-amber-500',
  COTE_RESTAURANT: 'bg-rose-500',
  ANAAM: 'bg-violet-500',
}

export function toneFor(point: MapPoint) {
  if (point.kind === 'STATION') return 'bg-navy'
  return TONE[point.engineKinds[0] ?? ''] ?? 'bg-slate-500'
}

export function MarkerIcon({ point, size = 14 }: { point: MapPoint; size?: number }) {
  if (point.kind === 'STATION') return <Building2 size={size + 3} />
  const engine = point.engineKinds[0]
  if (engine === 'LAGOON') return <Anchor size={size} />
  if (engine === 'MOBILITY') return <Bike size={size} />
  if (engine === 'COTE_RESTAURANT') return <UtensilsCrossed size={size} />
  return <PackageOpen size={size} />
}

