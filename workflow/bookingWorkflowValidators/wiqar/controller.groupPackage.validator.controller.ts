import type { ValidationResult, WorkflowContext } from '../../shared/types.js'
import { requireAvailableUnit, requirePaid, requirePositiveDuration } from '../shared.validators.js'
import {
  requireConsent,
  requireFeedPurchased,
  requireMinimumParty,
  requireNamedTrainer,
  requireWithinSlotGrace,
  requireWorkableAnimal,
} from '../shared.animal.validators.js'

/**
 * What Group Package refuses, and why.
 *
 * EXP-07 — a camel tour, an animal feeding and a photo session sold together to a party of at least five.
 *
 * The welfare checks are the shared ones every WIQAR experience composes. What is written here
 * is only what makes this experience different from the other six.
 */

/** §4.1 EXP-07: the group package is sold to parties of five or more. */
const MINIMUM_PARTY = 5

export const useGroupPackageValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      // Everything its three parts need, asked once, so a group fails here rather than half way through its afternoon.
      errors.push(
        ...requireConsent(ctx),
        ...requireMinimumParty(ctx, MINIMUM_PARTY),
        // ASSUMPTION A-1 — it contains a camel tour and a feeding session, so it inherits their assumption.
        ...requireNamedTrainer(ctx),
        ...requireWorkableAnimal(ctx),
        ...requireFeedPurchased(ctx),
      )
      break
    }

    case 'TO_STARTED': {
      // Ninety minutes across three experiences, so the clock matters — a group running long holds a camel the next party is booked on.
      errors.push(
        ...requirePaid(ctx),
        ...requireWithinSlotGrace(ctx),
        ...requireMinimumParty(ctx, MINIMUM_PARTY),
        ...requireWorkableAnimal(ctx),
        ...requireAvailableUnit(ctx),
        // §4.1 gives this experience a duration of 90 min.
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
