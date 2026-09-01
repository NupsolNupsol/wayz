/** Where a scanned sticker lands: the asset's own page, resolved from the unit id. */
export const assetUnitUrl = (unitId: string): string => `${window.location.origin}/assets/unit/${unitId}`
