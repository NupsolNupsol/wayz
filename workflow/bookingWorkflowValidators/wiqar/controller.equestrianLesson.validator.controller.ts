import type { ValidationResult, WorkflowContext } from '../../shared/types.js'
import { requireAvailableUnit, requirePaid, requirePositiveDuration } from '../shared.validators.js'
import {
  requireConsent,
  requireNamedTrainer,
  requireWithinSlotGrace,
  requireWorkableAnimal,
} from '../shared.animal.validators.js'

/**
 * What Equestrian Lesson refuses, and why.
 *
 * EXP-02 — a structured lesson from a certified trainer, at beginner or intermediate level.
 *
 * The welfare checks are the shared ones every WIQAR experience composes. What is written here
 * is only what makes this experience different from the other six.
 */

/**
 * A lesson has a level, and it is not optional.
 *
 * §4.1 EXP-02 offers beginner and intermediate. Which one decides the horse, the pace and what
 * the trainer prepares, so a lesson booked without one is a lesson nobody can plan.
 */
function requireLevel(ctx: WorkflowContext): string[] {
  const level = String(ctx.booking.metadata?.level ?? ctx.payload.level ?? '').trim().toUpperCase()
  if (!level) return ['Choose the level this lesson is booked at.']
  return ['BEGINNER', 'INTERMEDIATE'].includes(level)
    ? []
    : [`"${level}" is not a level this lesson is taught at.`]
}

export const useEquestrianLessonValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      // §11.1 for the trainer; §4.1 EXP-02 for the level it is taught at.
      errors.push(
        ...requireConsent(ctx),
        // §11.1 — a riding session must have a named trainer.
        ...requireNamedTrainer(ctx),
        ...requireWorkableAnimal(ctx),
        ...requireLevel(ctx),
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
        // §4.1 gives this experience a duration of 45–60 min.
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
