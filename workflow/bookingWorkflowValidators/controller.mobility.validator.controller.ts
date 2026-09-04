import type { ValidationResult, WorkflowContext } from '../shared/types.js'
import { requireAvailableUnit, requireFlag, requirePaid, requirePositiveDuration, requireReason, requireTargetUnitAvailable } from './shared.validators.js'

export const useMobilityValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      break
    }

    case 'TO_HANDOVER': {
      errors.push(
        ...requirePaid(ctx),
        ...requireFlag(ctx, 'inspectionDone', 'A condition inspection must be recorded before handover.'),
        ...requireAvailableUnit(ctx),
        ...requirePositiveDuration(ctx),
      )
      break
    }

    case 'TO_REPLACED': {
      errors.push(...requireReason(ctx), ...requireTargetUnitAvailable(ctx))
      break
    }

    case 'TO_RETURNED': {
      break
    }

    case 'TO_CANCELLED': {
      errors.push(...requireReason(ctx))
      break
    }

    default: {
      errors.push(`Unknown transition code: ${transitionCode}`)
      break
    }
  }

  return { errors }
}
