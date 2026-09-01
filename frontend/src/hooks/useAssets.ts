import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assetApi, type AddUnitsInput, type NewAssetKind, type TypePricePatch, type UnitPatch } from '../api/asset.api'
import { qk } from './queryKeys'
import type { EngineKind } from '../api/types'

export const useAssetEstate = (engineKind?: EngineKind) =>
  useQuery({ queryKey: qk.assets.estate(engineKind ?? 'all'), queryFn: () => assetApi.estate(engineKind) })

export const useAssetType = (id: string | undefined) =>
  useQuery({ queryKey: qk.assets.type(id ?? ''), queryFn: () => assetApi.typeDetail(id!), enabled: !!id })

export const useAssetUnit = (id: string | undefined) =>
  useQuery({ queryKey: qk.assets.unit(id ?? ''), queryFn: () => assetApi.unit(id!), enabled: !!id })

/** Every change touches both the list totals and the detail rows, so both are refreshed. */
function useAssetInvalidation() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['assets'] })
    void qc.invalidateQueries({ queryKey: qk.units })
  }
}

export const useCreateAssetKind = () => {
  const refresh = useAssetInvalidation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewAssetKind) => assetApi.createType(body),
    onSuccess: () => {
      refresh()
      void qc.invalidateQueries({ queryKey: qk.manager.pricing })
      void qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useUpdateAssetKind = () => {
  const refresh = useAssetInvalidation()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; capacity?: NewAssetKind['capacity'] } }) =>
      assetApi.updateType(id, body),
    onSuccess: refresh,
  })
}

export const useRemoveAssetKind = () => {
  const refresh = useAssetInvalidation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => assetApi.removeType(id),
    onSuccess: () => {
      refresh()
      void qc.invalidateQueries({ queryKey: qk.manager.pricing })
    },
  })
}

export const useAddAssetUnits = () => {
  const refresh = useAssetInvalidation()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddUnitsInput }) => assetApi.addUnits(id, body),
    onSuccess: refresh,
  })
}

export const useUpdateAssetUnit = () => {
  const refresh = useAssetInvalidation()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UnitPatch }) => assetApi.updateUnit(id, body),
    onSuccess: refresh,
  })
}

export const useRemoveAssetUnit = () => {
  const refresh = useAssetInvalidation()
  return useMutation({ mutationFn: (id: string) => assetApi.removeUnit(id), onSuccess: refresh })
}

export const usePriceAssetType = () => {
  const refresh = useAssetInvalidation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TypePricePatch }) => assetApi.priceType(id, body),
    onSuccess: () => {
      refresh()
      void qc.invalidateQueries({ queryKey: qk.manager.pricing })
      void qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
