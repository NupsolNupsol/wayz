import { OPS, TILL } from '../../shared/access.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED, DRAFT, OVERTIME } from '../../shared/status.js'
import { MINIMUM_FEED_PORTIONS } from '../../bookingWorkflowValidators/shared.animal.validators.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../../shared/types.js'
import { useAnimalFeedingValidator } from '../../bookingWorkflowValidators/wiqar/controller.animalFeeding.validator.controller.js'
import { useAnimalFeedingOperation } from '../../bookingWorkflowOperations/wiqar/controller.animalFeeding.operation.controller.js'

/**
 * Animal Feeding Session.
 *
 * EXP-05 — the visitor buys feed from WIQAR and gives it to a horse, camel or goat under supervision.
 *
 * One of WIQAR's seven coded experiences. It shares the animal-welfare rules with the others —
 * see `shared.animal.validators.ts` and `shared.animal.operations.ts` — and differs in what it
 * asks for before it will run, which is written in its own validator rather than configured.
 */
export const animalFeedingWorkflow: EngineWorkflow = {
  engineKind: 'ANIMAL_FEEDING',
  assetKind: 'ANIMAL',
  sessionKind: 'EXPERIENCE',
  initialStatus: DRAFT,
  actors: OPS,
  // What confirmation asks the counter for — the same checks its validator composes.
  intake: [{ key: 'consent' }, { key: 'feedPortions', min: MINIMUM_FEED_PORTIONS }],
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

export const LaunchAnimalFeedingControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useAnimalFeedingValidator(transitionCode, ctx)

export const LaunchAnimalFeedingOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useAnimalFeedingOperation(transitionCode, ctx)
