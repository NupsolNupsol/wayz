import { OPS, TILL } from '../shared/access.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED, DRAFT, OVERTIME } from '../shared/status.js'
import type { EngineWorkflow, OperationResult, ValidationResult, WorkflowContext } from '../shared/types.js'
import { useMobilityValidator } from '../bookingWorkflowValidators/controller.mobility.validator.controller.js'
import { useMobilityOperation } from '../bookingWorkflowOperations/controller.mobility.operation.controller.js'

export const mobilityWorkflow: EngineWorkflow = {
  engineKind: 'MOBILITY',
  assetKind: 'VEHICLE',
  sessionKind: 'RENTAL',
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
      code: 'TO_HANDOVER',
      label: 'Confirm handover (start rental)',
      source: [CONFIRMED],
      target: ACTIVE,
      actors: OPS,
      style: { backgroundColor: '#1a3470' },
    },
    {
      code: 'TO_RETURNED',
      label: 'Return asset',
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

export const LaunchMobilityControl = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<ValidationResult> => useMobilityValidator(transitionCode, ctx)

export const LaunchMobilityOperation = async (
  transitionCode: string,
  ctx: WorkflowContext,
): Promise<OperationResult> => useMobilityOperation(transitionCode, ctx)
