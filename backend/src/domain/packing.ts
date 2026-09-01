import type { AssetTypeDoc } from '../models/index.js'
import type { BagItem } from '../models/index.js'
import type { BillingModel } from './types.js'

export function bagScore(bag: Pick<BagItem, 'dimensions' | 'weight'>): number {
  const vol = (bag.dimensions.w * bag.dimensions.h * bag.dimensions.d) / 1000
  return Math.max(1, Math.round(vol + bag.weight * 2))
}

export interface PackingResult {
  requiredCapacityScore: number
  numberOfCompartmentsRequired: number
  allocations: { compartmentIndex: number; bagIndexes: number[] }[]
}

export function packBags(bags: BagItem[], assetType: AssetTypeDoc): PackingResult {
  const capScore = assetType.capacity.capacityScore
  const maxCount = assetType.capacity.maxRecommendedBagCount ?? Infinity

  const scored = bags
    .map((b) => ({ index: b.index, score: bagScore(b) }))
    .sort((a, b) => b.score - a.score)

  const bins: { bagIndexes: number[]; used: number }[] = []
  for (const item of scored) {
    let placed = false
    for (const bin of bins) {
      if (bin.used + item.score <= capScore && bin.bagIndexes.length < maxCount) {
        bin.bagIndexes.push(item.index)
        bin.used += item.score
        placed = true
        break
      }
    }
    if (!placed) bins.push({ bagIndexes: [item.index], used: item.score })
  }

  return {
    requiredCapacityScore: scored.reduce((s, x) => s + x.score, 0),
    numberOfCompartmentsRequired: bins.length,
    allocations: bins.map((b, i) => ({ compartmentIndex: i, bagIndexes: b.bagIndexes.sort((a, c) => a - c) })),
  }
}

export interface Quote {
  amount: number
  summary: string
}

export function priceQuote(
  billing: BillingModel,
  unitPrice: number,
  bagCount: number,
  compartments: number,
  durationPeriods: number,
  packagePrice = 0,
): Quote {
  switch (billing) {
    case 'PER_BAG':
      return { amount: unitPrice * bagCount, summary: `${bagCount} bag(s) × ${unitPrice} (PER_BAG)` }
    case 'PER_COMPARTMENT':
      return { amount: unitPrice * compartments, summary: `${compartments} compartment(s) × ${unitPrice} (PER_COMPARTMENT)` }
    case 'PACKAGE':
      return { amount: packagePrice || unitPrice, summary: `Flat package covering ${bagCount} bag(s)` }
    case 'DURATION_BASED':
      return { amount: unitPrice * Math.max(1, Math.ceil(durationPeriods)), summary: `${Math.ceil(durationPeriods)} period(s) × ${unitPrice} (DURATION_BASED)` }
    default:
      return { amount: unitPrice * bagCount, summary: `${bagCount} × ${unitPrice}` }
  }
}
