import type { EngineKind, EngineWorkflow, AssetKind } from '../shared/types.js'
import { ASSET_KIND_BY_ENGINE } from '../shared/types.js'
import { shopDropWorkflow } from './booking.shopdrop.workflow.js'
import { mobilityWorkflow } from './booking.mobility.workflow.js'
import { lagoonWorkflow } from './booking.lagoon.workflow.js'
import { coteWorkflow } from './booking.cote.workflow.js'
import { anaamWorkflow } from './booking.anaam.workflow.js'

export const allEnginesWorkflow: Record<EngineKind, EngineWorkflow> = {
  SHOP_AND_DROP: shopDropWorkflow,
  MOBILITY: mobilityWorkflow,
  LAGOON: lagoonWorkflow,
  COTE_RESTAURANT: coteWorkflow,
  ANAAM: anaamWorkflow,
}

export function getWorkflow(engineKind: string): EngineWorkflow | null {
  return allEnginesWorkflow[engineKind as EngineKind] ?? null
}

export function getWorkflowByAssetKind(assetKind: AssetKind): EngineWorkflow | null {
  const entry = Object.values(allEnginesWorkflow).find((wf) => wf.assetKind === assetKind)
  return entry ?? null
}

export function assertRegistryConsistent(): void {
  for (const [engine, wf] of Object.entries(allEnginesWorkflow)) {
    const expected = ASSET_KIND_BY_ENGINE[engine as EngineKind]
    if (wf.assetKind !== expected) {
      throw new Error(`Workflow ${engine} declares assetKind ${wf.assetKind}, expected ${expected}.`)
    }
    if (wf.engineKind !== engine) {
      throw new Error(`Workflow registered under ${engine} declares engineKind ${wf.engineKind}.`)
    }
  }
}
