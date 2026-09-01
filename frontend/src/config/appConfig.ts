export const APP = {
  name: 'WAYZ',
  product: 'Agent POS',
  version: '1.0.0-mvp',
  vatRate: 0.15,
  currency: 'SAR',
  storageKey: 'wayz.agent.pos.v1',
  demoDefaultStorageMinutes: 120,
  serviceLatencyMs: 260,
} as const

export const FEATURE_FLAGS = {
  deliveryToCarEnabled: false,
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS
