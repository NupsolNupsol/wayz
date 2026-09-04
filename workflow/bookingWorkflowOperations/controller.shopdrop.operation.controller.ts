import type { OperationResult, WorkflowContext } from '../shared/types.js'
import {
  ACTIVE,
  AGENT_HOLDER,
  CANCELLED,
  COMPLETED,
  CONFIRMED,
  CUSTOMER,
  LOCKER,
  RESERVED,
  RETRIEVAL_IN_PROGRESS,
  UNIT_RETRIEVAL_PENDING,
} from '../shared/status.js'
import { beginOperation, unknownTransition } from '../utils/clone.js'
import { addCustody, cancelRelease, completeAndRelease, consumeVerification, markUnit, reassignUnit, reserveUnit, setStatus, startTimer, storeBagsAndOccupy } from './shared.operations.js'

export const useShopDropOperation = (transitionCode: string, ctx: WorkflowContext): OperationResult => {
  const result = beginOperation(ctx)

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      addCustody(result, ctx, { from: CUSTOMER, to: AGENT_HOLDER, note: 'Bags received at desk' })
      setStatus(result, CONFIRMED)
      break
    }

    case 'TO_RESERVED': {
      reserveUnit(result, ctx)
      setStatus(result, RESERVED)
      break
    }

    case 'TO_REASSIGNED': {
      reassignUnit(result, ctx)
      setStatus(result, RESERVED)
      break
    }

    case 'TO_STORED': {
      storeBagsAndOccupy(result, ctx)
      startTimer(result, ctx)
      addCustody(result, ctx, { from: AGENT_HOLDER, to: LOCKER, note: 'Stored — timer started' })
      setStatus(result, ACTIVE)
      break
    }

    case 'TO_RETRIEVAL': {
      consumeVerification(result, ctx, 'RETRIEVAL')
      markUnit(result, UNIT_RETRIEVAL_PENDING)
      addCustody(result, ctx, { from: CUSTOMER, to: AGENT_HOLDER, note: 'Identity verified — retrieval authorised' })
      setStatus(result, RETRIEVAL_IN_PROGRESS)
      break
    }

    case 'TO_COMPLETED': {
      completeAndRelease(result, ctx)
      addCustody(result, ctx, { from: AGENT_HOLDER, to: CUSTOMER, note: 'Customer handover complete' })
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
