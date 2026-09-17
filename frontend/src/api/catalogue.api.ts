import { http, unwrap } from './client';
import type {
  AssetTypeLite,
  AssetUnit,
  EngineKind,
  PackingSuggestResponse,
  Product,
} from './types';

export interface SuggestBag {
  category?: string;
  dimensions?: { w: number; h: number; d: number };
  weight?: number;
}

export const catalogueApi = {
  products: (engineKind?: EngineKind) =>
    unwrap<Product[]>(
      http.get('/catalogue/products', { params: engineKind ? { engineKind } : {} })
    ),
  units: () => unwrap<AssetUnit[]>(http.get('/catalogue/units')),
  /** Staff at this location who can be named to run a session of the activity. */
  trainers: (engineKind: EngineKind) =>
    unwrap<{ id: string; name: string; title: string }[]>(
      http.get('/catalogue/trainers', { params: { engineKind } })
    ),
  assetTypes: () => unwrap<AssetTypeLite[]>(http.get('/catalogue/asset-types')),
  packingSuggestions: (bags: SuggestBag[]) =>
    unwrap<PackingSuggestResponse>(http.post('/catalogue/packing-suggestions', { bags })),
};
