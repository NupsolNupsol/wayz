import type { EngineKind, WorkflowOperator } from '../shared/types.js'
import { LaunchShopDropOperation } from './booking.shopdrop.workflow.js'
import { LaunchMobilityOperation } from './booking.mobility.workflow.js'
import { LaunchLagoonOperation } from './booking.lagoon.workflow.js'
import { LaunchCoteOperation } from './booking.cote.workflow.js'
import { LaunchAnaamOperation } from './booking.anaam.workflow.js'

export const wfOperators: Record<EngineKind, WorkflowOperator> = {
  SHOP_AND_DROP: LaunchShopDropOperation,
  MOBILITY: LaunchMobilityOperation,
  LAGOON: LaunchLagoonOperation,
  COTE_RESTAURANT: LaunchCoteOperation,
  ANAAM: LaunchAnaamOperation,
}

export function getOperator(engineKind: string): WorkflowOperator | null {
  return wfOperators[engineKind as EngineKind] ?? null
}
