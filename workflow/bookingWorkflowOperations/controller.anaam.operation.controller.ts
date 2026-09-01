import type { OperationResult, WorkflowContext } from '../shared/types.js'
import { ACTIVE, CANCELLED, COMPLETED, CONFIRMED } from '../shared/status.js'
import { beginOperation, unknownTransition } from '../utils/clone.js'
import { assignAndOccupy, cancelRelease, completeAndRelease, setStatus, startTimer } from './shared.operations.js'

export const useAnaamOperation = (transitionCode: string, ctx: WorkflowContext): OperationResult => {
  const result = beginOperation(ctx)

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
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
      completeAndRelease(result, ctx)
      setStatus(result, COMPLETED)
      break
    }

    case 'TO_CANCELLED': {
      cancelRelease(result)
      setStatus(result, CANCELLED)
      break
    }

    default:
      return unknownTransition(ctx, transitionCode)
  }

  return result
}
