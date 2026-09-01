import type { AssetKind, DeliveryOperator, DeliveryValidator, DeliveryWorkflowDef } from '../shared/types.js'
import { deliveryWorkflow, LaunchDeliveryControl, LaunchDeliveryOperation } from './delivery.workflow.js'

export const allDeliveryWorkflow: Partial<Record<AssetKind, DeliveryWorkflowDef>> = {
  COMPARTMENT: deliveryWorkflow,
}

export const dlvValidators: Partial<Record<AssetKind, DeliveryValidator>> = {
  COMPARTMENT: LaunchDeliveryControl,
}

export const dlvOperators: Partial<Record<AssetKind, DeliveryOperator>> = {
  COMPARTMENT: LaunchDeliveryOperation,
}

export const DEFAULT_DELIVERY_ASSET_KIND: AssetKind = 'COMPARTMENT'

export function getDeliveryWorkflow(assetKind: AssetKind = DEFAULT_DELIVERY_ASSET_KIND): DeliveryWorkflowDef | null {
  return allDeliveryWorkflow[assetKind] ?? null
}

export function getDeliveryValidator(assetKind: AssetKind = DEFAULT_DELIVERY_ASSET_KIND): DeliveryValidator | null {
  return dlvValidators[assetKind] ?? null
}

export function getDeliveryOperator(assetKind: AssetKind = DEFAULT_DELIVERY_ASSET_KIND): DeliveryOperator | null {
  return dlvOperators[assetKind] ?? null
}
