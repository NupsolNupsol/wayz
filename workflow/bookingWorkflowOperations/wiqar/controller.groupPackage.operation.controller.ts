import type { OperationResult, WorkflowContext } from '../../shared/types.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED } from '../../shared/status.js'
import { beginOperation, unknownTransition } from '../../utils/clone.js'
import { assignAndOccupy, cancelRelease, setStatus, startTimer } from '../shared.operations.js'
import { completeAndRest, recordHandler } from '../shared.animal.operations.js'

/**
 * What Group Package does when it moves.
 *
 * EXP-07 — a camel tour, an animal feeding and a photo session sold together to a party of at least five.
 *
 * Completion stands the animal down to rest rather than releasing it — §7.3 and §11.1. That is
 * the one thing no WIQAR experience is allowed to do differently, which is why it comes from
 * the shared animal operations and not from here.
 */
export const useGroupPackageOperation = (transitionCode: string, ctx: WorkflowContext): OperationResult => {
  const result = beginOperation(ctx)

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      recordHandler(result, ctx)
      setStatus(result, CONFIRMED)
      break
    }

    case 'TO_STARTED': {
      assignAndOccupy(result, ctx)
      startTimer(result, ctx)
      setStatus(result, ACTIVE)
      break
    }

    case 'TO_COMPLETED': {
      completeAndRest(result, ctx)
      setStatus(result, COMPLETED)
      break
    }

    case 'TO_CANCELLED': {
      cancelRelease(result, ctx)
      setStatus(result, CANCELLED)
      break
    }

    default:
      return unknownTransition(ctx, transitionCode)
  }

  return result
}
