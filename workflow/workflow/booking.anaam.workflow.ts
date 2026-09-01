import { OPS, TILL } from '../shared/access.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED, DRAFT, OVERTIME } from '../shared/status.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../shared/types.js'
import { useAnaamValidator } from '../bookingWorkflowValidators/controller.anaam.validator.controller.js'
import { useAnaamOperation } from '../bookingWorkflowOperations/controller.anaam.operation.controller.js'

export const anaamWorkflow: EngineWorkflow = {
  engineKind: 'ANAAM',
  assetKind: 'ANIMAL',
  sessionKind: 'EXPERIENCE',
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
      label: 'Start experience',
      source: [CONFIRMED],
      target: ACTIVE,
      actors: OPS,
      style: { backgroundColor: '#1a3470' },
    },
    {
      code: 'TO_COMPLETED',
      label: 'Complete',
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

export const LaunchAnaamControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useAnaamValidator(transitionCode, ctx)

export const LaunchAnaamOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useAnaamOperation(transitionCode, ctx)
