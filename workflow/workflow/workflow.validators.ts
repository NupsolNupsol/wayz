import type { EngineKind, WorkflowValidator } from '../shared/types.js'
import { LaunchShopDropControl } from './booking.shopdrop.workflow.js'
import { LaunchMobilityControl } from './booking.mobility.workflow.js'
import { LaunchLagoonControl } from './booking.lagoon.workflow.js'
import { LaunchCoteControl } from './booking.cote.workflow.js'
import { LaunchAnaamControl } from './booking.anaam.workflow.js'

export const wfValidators: Record<EngineKind, WorkflowValidator> = {
  SHOP_AND_DROP: LaunchShopDropControl,
  MOBILITY: LaunchMobilityControl,
  LAGOON: LaunchLagoonControl,
  COTE_RESTAURANT: LaunchCoteControl,
  ANAAM: LaunchAnaamControl,
}

export function getValidator(engineKind: string): WorkflowValidator | null {
  return wfValidators[engineKind as EngineKind] ?? null
}
