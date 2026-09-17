import { OPS, TILL } from '../../shared/access.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED, DRAFT, OVERTIME } from '../../shared/status.js'
import { GROUP_MINIMUM_PARTY, MINIMUM_FEED_PORTIONS } from '../../bookingWorkflowValidators/shared.animal.validators.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../../shared/types.js'
import { useGroupPackageValidator } from '../../bookingWorkflowValidators/wiqar/controller.groupPackage.validator.controller.js'
import { useGroupPackageOperation } from '../../bookingWorkflowOperations/wiqar/controller.groupPackage.operation.controller.js'

/**
 * Group Package.
 *
 * EXP-07 — a camel tour, an animal feeding and a photo session sold together to a party of at least five.
 *
 * One of WIQAR's seven coded experiences. It shares the animal-welfare rules with the others —
 * see `shared.animal.validators.ts` and `shared.animal.operations.ts` — and differs in what it
 * asks for before it will run, which is written in its own validator rather than configured.
 */
export const groupPackageWorkflow: EngineWorkflow = {
  engineKind: 'GROUP_PACKAGE',
  assetKind: 'ANIMAL',
  sessionKind: 'EXPERIENCE',
  initialStatus: DRAFT,
  actors: OPS,
  // What confirmation asks the counter for — the same checks its validator composes.
  intake: [
    { key: 'consent' },
    { key: 'trainer' },
    { key: 'partySize', min: GROUP_MINIMUM_PARTY },
    { key: 'feedPortions', min: MINIMUM_FEED_PORTIONS },
  ],
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

export const LaunchGroupPackageControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useGroupPackageValidator(transitionCode, ctx)

export const LaunchGroupPackageOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useGroupPackageOperation(transitionCode, ctx)
