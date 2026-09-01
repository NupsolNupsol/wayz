import { COURIER, KIOSK_OPS, OVERRIDE_ROLES } from '../shared/access.js'
import {
  DLV_ASSIGNED,
  DLV_CANCELLED,
  DLV_DELIVERED,
  DLV_FAILED,
  DLV_PICKED_UP,
  DLV_RELEASE_APPROVED,
  DLV_RELEASE_REQUESTED,
  DLV_REQUESTED,
} from '../shared/status.js'
import type {
  DeliveryContext,
  DeliveryOperationResult,
  DeliveryWorkflowDef,
  ValidationResult,
} from '../shared/types.js'
import { useDeliveryValidator } from '../deliveryWorkflowValidators/controller.delivery.validator.controller.js'
import { useDeliveryOperation } from '../deliveryWorkflowOperations/controller.delivery.operation.controller.js'

export const deliveryWorkflow: DeliveryWorkflowDef = {
  entity: 'DELIVERY',
  assetKind: 'COMPARTMENT',
  initialStatus: DLV_REQUESTED,
  actors: [...COURIER, ...KIOSK_OPS],
  transitions: [
    {
      code: 'TO_ASSIGNED',
      label: 'Pick up this task',
      source: [DLV_REQUESTED],
      target: DLV_ASSIGNED,
      actors: COURIER,
      style: { backgroundColor: '#204897' },
    },
    {
      code: 'TO_RELEASE_REQUESTED',
      label: 'Request the bags',
      source: [DLV_ASSIGNED, DLV_RELEASE_APPROVED],
      target: DLV_RELEASE_REQUESTED,
      actors: COURIER,
      style: { backgroundColor: '#f9b115' },
    },
    {
      code: 'TO_RELEASE_APPROVED',
      label: 'Approve & release compartment',
      source: [DLV_RELEASE_REQUESTED],
      target: DLV_RELEASE_APPROVED,
      actors: KIOSK_OPS,
      style: { backgroundColor: '#249542' },
    },
    {
      code: 'TO_PICKED_UP',
      label: 'Confirm bags collected',
      source: [DLV_RELEASE_APPROVED],
      target: DLV_PICKED_UP,
      actors: COURIER,
      style: { backgroundColor: '#1a3470' },
    },
    {
      code: 'TO_DELIVERED',
      label: 'Mark delivered',
      source: [DLV_PICKED_UP],
      target: DLV_DELIVERED,
      actors: COURIER,
      style: { backgroundColor: '#2ECC71' },
    },
    {
      code: 'TO_FAILED',
      label: 'Report a problem',
      source: [DLV_PICKED_UP],
      target: DLV_FAILED,
      actors: COURIER,
      style: { backgroundColor: '#db5d5d' },
    },
    {
      code: 'TO_CANCELLED',
      label: 'Cancel request',
      source: [DLV_REQUESTED, DLV_ASSIGNED, DLV_RELEASE_REQUESTED],
      target: DLV_CANCELLED,
      actors: [...KIOSK_OPS, ...COURIER, ...OVERRIDE_ROLES],
      style: { backgroundColor: '#8a8a8a' },
    },
  ],
}

export const LaunchDeliveryControl = async (
  transitionCode: string,
  ctx: DeliveryContext,
): Promise<ValidationResult> => useDeliveryValidator(transitionCode, ctx)

export const LaunchDeliveryOperation = async (
  transitionCode: string,
  ctx: DeliveryContext,
): Promise<DeliveryOperationResult> => useDeliveryOperation(transitionCode, ctx)

export function getDeliveryTransition(code: string) {
  return deliveryWorkflow.transitions.find((t) => t.code === code) ?? null
}
