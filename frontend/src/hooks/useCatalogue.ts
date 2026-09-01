import { useMutation, useQuery } from '@tanstack/react-query'
import { catalogueApi, type SuggestBag } from '../api/catalogue.api'
import { qk } from './queryKeys'
import type { EngineKind } from '../api/types'

export const useProducts = (engineKind?: EngineKind) => useQuery({ queryKey: qk.products(engineKind), queryFn: () => catalogueApi.products(engineKind) })
export const useUnits = () => useQuery({ queryKey: qk.units, queryFn: catalogueApi.units })
export const useAssetTypes = () => useQuery({ queryKey: ['assetTypes'], queryFn: catalogueApi.assetTypes, staleTime: Infinity })


export function usePackingSuggestions() {
  return useMutation({ mutationFn: (bags: SuggestBag[]) => catalogueApi.packingSuggestions(bags) })
}
