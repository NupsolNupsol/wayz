import type { ValidationResult, WorkflowContext } from '../../shared/types.js'
import { requireAvailableUnit, requirePaid, requirePositiveDuration } from '../shared.validators.js'
import {
  requireConsent,
  requireNamedTrainer,
  requireWithinSlotGrace,
  requireWorkableAnimal,
} from '../shared.animal.validators.js'

/**
 * What Animal Care Pack refuses, and why.
 *
 * EXP-04 — the visitor grooms and showers their assigned horse, guided by a trainer.
 *
 * The welfare checks are the shared ones every WIQAR experience composes. What is written here
 * is only what makes this experience different from the other six.
 */

export const useAnimalCareValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      // §11.1 covers care sessions explicitly — §4.1 EXP-04 includes trainer guidance.
      errors.push(
        ...requireConsent(ctx),
        // §11.1 — a care session must have a named trainer.
        ...requireNamedTrainer(ctx),
        ...requireWorkableAnimal(ctx),
      )
      break
    }

    case 'TO_STARTED': {
      // Nobody mounts, but the horse is handled at close quarters — §11.1's trainer was named at confirmation.
      errors.push(
        ...requirePaid(ctx),
        ...requireWithinSlotGrace(ctx),
        ...requireWorkableAnimal(ctx),
        ...requireAvailableUnit(ctx),
        // §4.1 gives this experience a duration of 30 min.
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
