import { OPS, TILL } from '../../shared/access.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED, DRAFT, OVERTIME } from '../../shared/status.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../../shared/types.js'
import { useCamelTourValidator } from '../../bookingWorkflowValidators/wiqar/controller.camelTour.validator.controller.js'
import { useCamelTourOperation } from '../../bookingWorkflowOperations/wiqar/controller.camelTour.operation.controller.js'

/**
 * Camel Tour.
 *
 * EXP-03 — a guided camel walk within the grounds, led on foot by a trainer.
 *
 * One of WIQAR's seven coded experiences. It shares the animal-welfare rules with the others —
 * see `shared.animal.validators.ts` and `shared.animal.operations.ts` — and differs in what it
 * asks for before it will run, which is written in its own validator rather than configured.
 */
export const camelTourWorkflow: EngineWorkflow = {
  engineKind: 'CAMEL_TOUR',
  assetKind: 'ANIMAL',
  sessionKind: 'EXPERIENCE',
  initialStatus: DRAFT,
  actors: OPS,
  transitions: [
    {
      code: 'TO_CONFIRMED',
      label: 'Confirm booking',
      source: [DRAFT],
      target: CONFIRMED,
      actors: TILL,
      style: { backgroundColor: '#249542' },
    },
    {
      code: 'TO_STARTED',
      label: 'Start session',
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

export const LaunchCamelTourControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useCamelTourValidator(transitionCode, ctx)

export const LaunchCamelTourOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useCamelTourOperation(transitionCode, ctx)
