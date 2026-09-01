import type { OperationResult, WorkflowContext } from '../shared/types.js'
import { CANCELLED, COMPLETED, PREPARING } from '../shared/status.js'
import { beginOperation, unknownTransition } from '../utils/clone.js'
import { cancelRelease, completeAndRelease, setStatus } from './shared.operations.js'

export const useCoteOperation = (transitionCode: string, ctx: WorkflowContext): OperationResult => {
  const result = beginOperation(ctx)

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      setStatus(result, PREPARING)
      result.audits.push({ action: 'FIRE_TO_KITCHEN', detail: result.booking.ref })
      break
    }

    case 'TO_SERVED': {
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
