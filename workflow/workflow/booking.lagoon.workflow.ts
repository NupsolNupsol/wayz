import { OPS, TILL } from '../shared/access.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED, DRAFT, OVERTIME } from '../shared/status.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../shared/types.js'
import { useLagoonValidator } from '../bookingWorkflowValidators/controller.lagoon.validator.controller.js'
import { useLagoonOperation } from '../bookingWorkflowOperations/controller.lagoon.operation.controller.js'

export const lagoonWorkflow: EngineWorkflow = {
  engineKind: 'LAGOON',
  assetKind: 'BOAT',
  sessionKind: 'ACTIVITY',
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
      code: 'TO_STARTED',
      label: 'Start trip',
      source: [CONFIRMED],
      target: ACTIVE,
      actors: OPS,
      style: { backgroundColor: '#1a3470' },
    },
    {
      code: 'TO_COMPLETED',
      label: 'Return & complete',
      source: [ACTIVE, OVERTIME],
      target: COMPLETED,
      actors: OPS,
      style: { backgroundColor: '#2ECC71' },
    },
    {
      code: 'TO_CANCELLED',
      label: 'Cancel',
      source: [DRAFT, CONFIRMED],
      target: CANCELLED,
      actors: OPS,
      style: { backgroundColor: '#db5d5d' },
    },
  ],
}

export const LaunchLagoonControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useLagoonValidator(transitionCode, ctx)

export const LaunchLagoonOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useLagoonOperation(transitionCode, ctx)
