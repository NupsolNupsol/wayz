import { OPS, TILL } from '../shared/access.js'
import {
  ACTIVE,
  CANCELLED,
  COMPLETED,
  CONFIRMED,
  DRAFT,
  OVERTIME,
  RESERVED,
  RETRIEVAL_IN_PROGRESS,
} from '../shared/status.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../shared/types.js'
import { useShopDropValidator } from '../bookingWorkflowValidators/controller.shopdrop.validator.controller.js'
import { useShopDropOperation } from '../bookingWorkflowOperations/controller.shopdrop.operation.controller.js'

export const shopDropWorkflow: EngineWorkflow = {
  engineKind: 'SHOP_AND_DROP',
  assetKind: 'COMPARTMENT',
  sessionKind: 'STORAGE',
  initialStatus: DRAFT,
  actors: OPS,
  transitions: [
    {
      code: 'TO_CONFIRMED',
      label: 'Confirm payment',
      source: [DRAFT],
      target: CONFIRMED,
      actors: TILL,
      style: { backgroundColor: '#249542' },
    },
    {
      code: 'TO_RESERVED',
      label: 'Reserve compartment',
      source: [CONFIRMED],
      target: RESERVED,
      actors: OPS,
      style: { backgroundColor: '#204897' },
    },
    {
      code: 'TO_REASSIGNED',
      label: 'Reassign compartment',
      source: [RESERVED],
      target: RESERVED,
      actors: OPS,
      style: { backgroundColor: '#f9b115' },
    },
    {
      code: 'TO_STORED',
      label: 'Confirm storage (start timer)',
      source: [RESERVED],
      target: ACTIVE,
      actors: OPS,
      style: { backgroundColor: '#1a3470' },
    },
    {
      code: 'TO_RETRIEVAL',
      label: 'Begin retrieval',
      source: [ACTIVE, OVERTIME],
      target: RETRIEVAL_IN_PROGRESS,
      actors: OPS,
      style: { backgroundColor: '#297e9c' },
    },
    {
      code: 'TO_COMPLETED',
      label: 'Confirm handover',
      source: [RETRIEVAL_IN_PROGRESS],
      target: COMPLETED,
      actors: OPS,
      style: { backgroundColor: '#2ECC71' },
    },
    {
      code: 'TO_CANCELLED',
      label: 'Cancel',
      source: [DRAFT, CONFIRMED, RESERVED],
      target: CANCELLED,
      actors: OPS,
      style: { backgroundColor: '#db5d5d' },
    },
  ],
}

export const LaunchShopDropControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useShopDropValidator(transitionCode, ctx)

export const LaunchShopDropOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useShopDropOperation(transitionCode, ctx)
