import { AssetType, AssetUnit, CatalogueProduct, Gate } from '../models/index.js'
import type { BagItem } from '../models/index.js'
import { packBags, bagScore } from '../domain/packing.js'
import type { PackingSuggestion, SuggestBagInput } from '../interfaces/index.js'

/**
 * What this desk can offer for these bags.
 *
 * Counted where the desk can actually reserve, which is its own counter plus the gates of its
 * station — a Shop & Drop counter holds no lockers of its own, they stand at the gates and the
 * bags are carried there. Counting only the counter would recommend nothing at all; counting the
 * whole tenant would recommend a plan that fails after the customer has paid.
 *
 * What is free but out of reach is still reported separately, so an agent can say where it is
 * rather than guess.
 */
export async function suggestPacking(
  tenantId: string,
  stationId: string,
  bags: SuggestBagInput[],
  kioskId?: string | null,
): Promise<{ recommendedProductId: string | null; totalScore: number; suggestions: PackingSuggestion[] }> {
  const bagItems: BagItem[] = bags.map((b, i) => ({
    index: i + 1,
    category: b.category ?? 'SOFT',
    description: '',
    dimensions: b.dimensions ?? { w: 30, h: 25, d: 20 },
    weight: b.weight ?? 3,
    barcode: '',
    status: 'REGISTERED',
    assignedUnitId: null,
  }))
  const totalScore = bagItems.reduce((s, b) => s + bagScore(b), 0)

  const products = await CatalogueProduct.find({
    tenantId,
    engineKind: 'SHOP_AND_DROP',
    active: true,
    assetTypeId: { $ne: null },
  })
    .sort({ basePrice: 1 })
    .lean()

  // The gates of this station: where its lockers stand, and what makes them reachable from here.
  const gates = await Gate.find({ tenantId, stationId, active: { $ne: false } }, { _id: 1 }).lean()
  const reach = kioskId
    ? gates.length
      ? { $or: [{ kioskId }, { gateId: { $in: gates.map((g) => g._id) } }] }
      : { kioskId }
    : {}

  const suggestions: PackingSuggestion[] = []
  const seenTypes = new Set<string>()

  for (const p of products) {
    if (!p.assetTypeId || seenTypes.has(p.assetTypeId)) continue
    const at = await AssetType.findOne({ _id: p.assetTypeId, tenantId }).lean()
    if (!at || at.kind !== 'COMPARTMENT') continue
    seenTypes.add(p.assetTypeId)

    const packed = packBags(bagItems, at)
    const [available, elsewhere] = await Promise.all([
      AssetUnit.countDocuments({ tenantId, stationId, assetTypeId: at._id, status: 'AVAILABLE', ...reach }),
      kioskId
        ? AssetUnit.countDocuments({
            tenantId,
            assetTypeId: at._id,
            status: 'AVAILABLE',
            $nor: [{ stationId, ...reach }],
          })
        : 0,
    ])
    suggestions.push({
      productId: p._id,
      productName: p.name,
      assetTypeId: at._id,
      assetTypeName: at.name,
      capacityScore: at.capacity.capacityScore,
      maxBagsPerCompartment: at.capacity.maxRecommendedBagCount ?? null,
      numberOfCompartments: packed.numberOfCompartmentsRequired,
      availableUnits: available,
      availableElsewhere: elsewhere,
      fits: available >= packed.numberOfCompartmentsRequired,
    })
  }

  suggestions.sort(
    (a, b) =>
      a.numberOfCompartments - b.numberOfCompartments ||
      Number(b.fits) - Number(a.fits) ||
      a.capacityScore - b.capacityScore,
  )

  const recommended = suggestions.find((s) => s.fits) ?? suggestions[0]
  return { recommendedProductId: recommended?.productId ?? null, totalScore, suggestions }
}
