import { OPS, TILL } from '../shared/access.js'
import { CANCELLED, COMPLETED, DRAFT, PREPARING } from '../shared/status.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../shared/types.js'
import { useCoteValidator } from '../bookingWorkflowValidators/controller.cote.validator.controller.js'
import { useCoteOperation } from '../bookingWorkflowOperations/controller.cote.operation.controller.js'

export const coteWorkflow: EngineWorkflow = {
  engineKind: 'COTE_RESTAURANT',
  assetKind: 'TABLE',
  sessionKind: 'DINING',
  initialStatus: DRAFT,
  actors: OPS,
  transitions: [
    {
      code: 'TO_CONFIRMED',
      label: 'Confirm payment (fire to kitchen)',
      source: [DRAFT],
      target: PREPARING,
      actors: TILL,
      style: { backgroundColor: '#249542' },
    },
    {
      code: 'TO_SERVED',
      label: 'Mark served',
      source: [PREPARING],
      target: COMPLETED,
      actors: OPS,
      style: { backgroundColor: '#2ECC71' },
    },
    {
      code: 'TO_CANCELLED',
      label: 'Cancel',
      source: [DRAFT, PREPARING],
      target: CANCELLED,
      actors: OPS,
      style: { backgroundColor: '#db5d5d' },
    },
  ],
}

export const LaunchCoteControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useCoteValidator(transitionCode, ctx)

export const LaunchCoteOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useCoteOperation(transitionCode, ctx)
