import type { ValidationResult, WorkflowContext } from '../../shared/types.js';
import {
  requireAvailableUnit,
  requirePaid,
  requirePositiveDuration,
} from '../shared.validators.js';
import {
  requireConsent,
  requireNamedTrainer,
  requireWithinSlotGrace,
  requireWorkableAnimal,
} from '../shared.animal.validators.js';

/**
 * What Camel Tour refuses, and why.
 *
 * EXP-03 — a guided camel walk within the grounds, led on foot by a trainer.
 *
 * The welfare checks are the shared ones every WIQAR experience composes. What is written here
 * is only what makes this experience different from the other six.
 */

export const useCamelTourValidator = (
  transitionCode: string,
  ctx: WorkflowContext
): ValidationResult => {
  const errors: string[] = [];

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      // Consent is §6.3; the trainer is an assumption, marked where it is asked for.
      errors.push(
        ...requireConsent(ctx),
        // ASSUMPTION A-1 — §11.1 names trainers for riding and care only; §5.1 lists camel trainers running tours.
        ...requireNamedTrainer(ctx),
        ...requireWorkableAnimal(ctx)
      );
      break;
    }

    case 'TO_STARTED': {
      // Paid, on time, on a workable camel, for the duration §4.1 gives it.
      errors.push(
        ...requirePaid(ctx),
        ...requireWithinSlotGrace(ctx),
        ...requireWorkableAnimal(ctx),
        ...requireAvailableUnit(ctx),
        // §4.1 gives this experience a duration of 20–30 min.
        ...requirePositiveDuration(ctx)
      );
      break;
    }

    case 'TO_COMPLETED': {
      break;
    }

    case 'TO_CANCELLED': {
      break;
    }

    default: {
      errors.push(`Unknown transition code: ${transitionCode}`);
      break;
    }
  }

  return { errors };
};
