import type { OperationResult, WorkflowContext } from '../shared/types.js'
import { CANCELLED, COMPLETED, CONFIRMED } from '../shared/status.js'
import { beginOperation, unknownTransition } from '../utils/clone.js'
import { cancelRelease, completeAndRelease, handOverToCustomer, replaceUnit, setStatus } from './shared.operations.js'

export const useMobilityOperation = (transitionCode: string, ctx: WorkflowContext): OperationResult => {
  const result = beginOperation(ctx)

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      setStatus(result, CONFIRMED)
      break
    }

    case 'TO_HANDOVER': {
      handOverToCustomer(result, ctx, 'Asset handed to customer')
      break
    }

    case 'TO_REPLACED': {
      replaceUnit(result, ctx)
      break
    }

    case 'TO_RETURNED': {
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
