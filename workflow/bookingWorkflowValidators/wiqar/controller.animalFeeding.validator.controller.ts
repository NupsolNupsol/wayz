import type { ValidationResult, WorkflowContext } from '../../shared/types.js'
import { requireAvailableUnit, requirePaid, requirePositiveDuration } from '../shared.validators.js'
import {
  requireConsent,
  requireFeedPurchased,
  requireWithinSlotGrace,
  requireWorkableAnimal,
} from '../shared.animal.validators.js'

/**
 * What Animal Feeding Session refuses, and why.
 *
 * EXP-05 — the visitor buys feed from WIQAR and gives it to a horse, camel or goat under supervision.
 *
 * The welfare checks are the shared ones every WIQAR experience composes. What is written here
 * is only what makes this experience different from the other six.
 */

export const useAnimalFeedingValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      // §6.5 makes the feed a retail line on the same sale, so a session with nothing bought to feed is not a session.
      errors.push(
        ...requireConsent(ctx),
        ...requireWorkableAnimal(ctx),
        ...requireFeedPurchased(ctx),
      )
      break
    }

    case 'TO_STARTED': {
      // The feed is checked again here: it is bought at the counter and the session starts at the paddock.
      errors.push(
        ...requirePaid(ctx),
        ...requireWithinSlotGrace(ctx),
        ...requireWorkableAnimal(ctx),
        ...requireFeedPurchased(ctx),
        ...requireAvailableUnit(ctx),
        // §4.1 gives this experience a duration of 15 min.
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
