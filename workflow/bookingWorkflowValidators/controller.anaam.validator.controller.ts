import type { ValidationResult, WorkflowContext } from '../shared/types.js'
import { requireAvailableUnit, requireFlag, requirePositiveDuration } from './shared.validators.js'

export const useAnaamValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      break
    }

    case 'TO_STARTED': {
      errors.push(
        ...requireFlag(ctx, 'safetyAck', 'Safety acknowledgement is required.'),
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
