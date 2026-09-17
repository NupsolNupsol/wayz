import type { EngineKind, EngineWorkflow, AssetKind } from '../shared/types.js';
import { ASSET_KIND_BY_ENGINE } from '../shared/types.js';
import { shopDropWorkflow } from './booking.shopdrop.workflow.js';
import { mobilityWorkflow } from './booking.mobility.workflow.js';
import { lagoonWorkflow } from './booking.lagoon.workflow.js';
import { coteWorkflow } from './booking.cote.workflow.js';
import { horseRidingWorkflow } from './wiqar/booking.horseRiding.workflow.js';
import { equestrianLessonWorkflow } from './wiqar/booking.equestrianLesson.workflow.js';
import { camelTourWorkflow } from './wiqar/booking.camelTour.workflow.js';
import { animalCareWorkflow } from './wiqar/booking.animalCare.workflow.js';
import { animalFeedingWorkflow } from './wiqar/booking.animalFeeding.workflow.js';
import { photographyWorkflow } from './wiqar/booking.photography.workflow.js';
import { groupPackageWorkflow } from './wiqar/booking.groupPackage.workflow.js';

export const allEnginesWorkflow: Record<EngineKind, EngineWorkflow> = {
  SHOP_AND_DROP: shopDropWorkflow,
  MOBILITY: mobilityWorkflow,
  LAGOON: lagoonWorkflow,
  COTE_RESTAURANT: coteWorkflow,
  HORSE_RIDING: horseRidingWorkflow,
  EQUESTRIAN_LESSON: equestrianLessonWorkflow,
  CAMEL_TOUR: camelTourWorkflow,
  ANIMAL_CARE: animalCareWorkflow,
  ANIMAL_FEEDING: animalFeedingWorkflow,
  PHOTOGRAPHY: photographyWorkflow,
  GROUP_PACKAGE: groupPackageWorkflow,
};

export function getWorkflow(engineKind: string): EngineWorkflow | null {
  return allEnginesWorkflow[engineKind as EngineKind] ?? null;
}

/**
 * The workflow for a kind of resource — only where exactly one activity claims it.
 *
 * Returns null when several do, which is now the case for `ANIMAL`: seven WIQAR experiences
 * work animals and they are seven different workflows. Answering with an arbitrary one of them
 * would be worse than answering with nothing, because the caller could not tell it had been
 * guessed at.
 */
export function getWorkflowByAssetKind(assetKind: AssetKind): EngineWorkflow | null {
  const claimants = Object.values(allEnginesWorkflow).filter((wf) => wf.assetKind === assetKind);
  return claimants.length === 1 ? claimants[0] : null;
}

export function assertRegistryConsistent(): void {
  for (const [engine, wf] of Object.entries(allEnginesWorkflow)) {
    const expected = ASSET_KIND_BY_ENGINE[engine as EngineKind];
    if (wf.assetKind !== expected) {
      throw new Error(
        `Workflow ${engine} declares assetKind ${wf.assetKind}, expected ${expected}.`
      );
    }
    if (wf.engineKind !== engine) {
      throw new Error(`Workflow registered under ${engine} declares engineKind ${wf.engineKind}.`);
    }
  }
}
