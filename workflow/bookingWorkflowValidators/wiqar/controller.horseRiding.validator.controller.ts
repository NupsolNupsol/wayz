import type { ValidationResult, WorkflowContext } from '../../shared/types.js'
import { requireAvailableUnit, requirePaid, requirePositiveDuration } from '../shared.validators.js'
import {
  requireConsent,
  requireNamedTrainer,
  requireWithinSlotGrace,
  requireWorkableAnimal,
} from '../shared.animal.validators.js'

/**
 * What Arabian Horse Riding Tour refuses, and why.
 *
 * EXP-01 — a guided trail ride on an Arabian horse, escorted by a trainer.
 *
 * The welfare checks are the shared ones every WIQAR experience composes. What is written here
 * is only what makes this experience different from the other six.
 */

export const useHorseRidingValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      // §11.1: a riding session is not confirmed until a trainer is named for it.
      errors.push(
        ...requireConsent(ctx),
        // §11.1 — a riding session must have a named trainer.
        ...requireNamedTrainer(ctx),
        ...requireWorkableAnimal(ctx),
      )
      break
    }

    case 'TO_STARTED': {
      // Paid, on time, on a workable horse, for the duration §4.1 gives it.
      errors.push(
        ...requirePaid(ctx),
        ...requireWithinSlotGrace(ctx),
        ...requireWorkableAnimal(ctx),
        ...requireAvailableUnit(ctx),
        // §4.1 gives this experience a duration of 30–60 min.
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
