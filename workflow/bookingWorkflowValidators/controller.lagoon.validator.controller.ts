import type { ValidationResult, WorkflowContext } from '../shared/types.js'
import { requireAvailableUnit, requireFlag, requirePositiveDuration } from './shared.validators.js'

export const useLagoonValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      break
    }

    case 'TO_STARTED': {
      errors.push(
        ...requireFlag(ctx, 'boardingVerified', 'Boarding count must be verified before dispatch.'),
        ...requireAvailableUnit(ctx),
        ...requirePositiveDuration(ctx),
      )
      break
    }

    case 'TO_COMPLETED': {
      break
    }

    case 'TO_CANCELLED': {
      break
    }

    default: {
      errors.push(`Unknown transition code: ${transitionCode}`)
      break
    }
  }

  return { errors }
}
