import type { ValidationResult, WorkflowContext } from '../../shared/types.js'
import { requirePaid, requirePositiveDuration } from '../shared.validators.js'
import { requireConsent, requireWithinSlotGrace, requireWorkableAnimal } from '../shared.animal.validators.js'

/**
 * What Professional Photo Session refuses, and why.
 *
 * EXP-06 — a studio session with an animal, delivered digitally or printed.
 *
 * The welfare checks are the shared ones every WIQAR experience composes. What is written here
 * is only what makes this experience different from the other six.
 */

export const usePhotographyValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      // No trainer is asked for: the specification names one for riding and care sessions, and a studio session is neither.
      errors.push(
        ...requireConsent(ctx),
        ...requireWorkableAnimal(ctx),
      )
      break
    }

    case 'TO_STARTED': {
      // Paid and on time. The animal is present rather than worked, so nothing more is asked of it.
      errors.push(
        ...requirePaid(ctx),
        // §4.1 gives this experience a duration of 20 min.
        ...requirePositiveDuration(ctx),
        ...requireWithinSlotGrace(ctx),
        ...requireWorkableAnimal(ctx),
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
