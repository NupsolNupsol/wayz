import { OPS, TILL } from '../../shared/access.js';
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED, DRAFT, OVERTIME } from '../../shared/status.js';
import type {
  EngineWorkflow,
  OperationResult,
  ValidationResult,
  WorkflowContext,
} from '../../shared/types.js';
import { useHorseRidingValidator } from '../../bookingWorkflowValidators/wiqar/controller.horseRiding.validator.controller.js';
import { useHorseRidingOperation } from '../../bookingWorkflowOperations/wiqar/controller.horseRiding.operation.controller.js';

/**
 * Arabian Horse Riding Tour.
 *
 * EXP-01 — a guided trail ride on an Arabian horse with a trainer escorting.
 *
 * One of WIQAR's seven coded experiences. It shares the animal-welfare rules with the others —
 * see `shared.animal.validators.ts` and `shared.animal.operations.ts` — and differs in what it
 * asks for before it will run, which is written in its own validator rather than configured.
 */
export const horseRidingWorkflow: EngineWorkflow = {
  engineKind: 'HORSE_RIDING',
  assetKind: 'ANIMAL',
  sessionKind: 'EXPERIENCE',
  initialStatus: DRAFT,
  actors: OPS,
  // What confirmation asks the counter for — the same checks its validator composes.
  intake: [{ key: 'consent' }, { key: 'trainer' }],
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
};

export const LaunchHorseRidingControl = async (
  transitionCode: string,
  ctx: WorkflowContext
): Promise<ValidationResult> => useHorseRidingValidator(transitionCode, ctx);

export const LaunchHorseRidingOperation = async (
  transitionCode: string,
  ctx: WorkflowContext
): Promise<OperationResult> => useHorseRidingOperation(transitionCode, ctx);
