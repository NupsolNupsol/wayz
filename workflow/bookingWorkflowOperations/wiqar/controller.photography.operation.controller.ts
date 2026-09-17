import type { OperationResult, WorkflowContext } from '../../shared/types.js';
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED } from '../../shared/status.js';
import { beginOperation, unknownTransition } from '../../utils/clone.js';
import { assignAndOccupy, cancelRelease, setStatus, startTimer } from '../shared.operations.js';
import { completeAndRest, recordHandler } from '../shared.animal.operations.js';

/**
 * What Professional Photo Session does when it moves.
 *
 * EXP-06 — a studio session with an animal, delivered digitally or printed.
 *
 * Completion stands the animal down to rest rather than releasing it — §7.3 and §11.1. That is
 * the one thing no WIQAR experience is allowed to do differently, which is why it comes from
 * the shared animal operations and not from here.
 */
export const usePhotographyOperation = (
  transitionCode: string,
  ctx: WorkflowContext
): OperationResult => {
  const result = beginOperation(ctx);

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      recordHandler(result, ctx);
      setStatus(result, CONFIRMED);
      break;
    }

    case 'TO_STARTED': {
      assignAndOccupy(result, ctx);
      startTimer(result, ctx);
      setStatus(result, ACTIVE);
      break;
    }

    case 'TO_COMPLETED': {
      completeAndRest(result, ctx);

      /*
       * How the photographs reach the visitor.
       *
       * §4.1 EXP-06 offers digital delivery, a printed package, or both. Recorded on completion
       * because it is what the studio actually did, which is not always what was sold.
       */
      const delivery = String(
        ctx.payload.delivery ?? ctx.booking.metadata?.delivery ?? 'DIGITAL'
      ).toUpperCase();
      result.booking.metadata = { ...result.booking.metadata, delivery };
      setStatus(result, COMPLETED);
      break;
    }

    case 'TO_CANCELLED': {
      cancelRelease(result, ctx);
      setStatus(result, CANCELLED);
      break;
    }

    default:
      return unknownTransition(ctx, transitionCode);
  }

  return result;
};
