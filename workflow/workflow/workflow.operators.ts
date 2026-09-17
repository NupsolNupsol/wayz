import type { EngineKind, WorkflowOperator } from '../shared/types.js';
import { LaunchShopDropOperation } from './booking.shopdrop.workflow.js';
import { LaunchMobilityOperation } from './booking.mobility.workflow.js';
import { LaunchLagoonOperation } from './booking.lagoon.workflow.js';
import { LaunchCoteOperation } from './booking.cote.workflow.js';
import { LaunchHorseRidingOperation } from './wiqar/booking.horseRiding.workflow.js';
import { LaunchEquestrianLessonOperation } from './wiqar/booking.equestrianLesson.workflow.js';
import { LaunchCamelTourOperation } from './wiqar/booking.camelTour.workflow.js';
import { LaunchAnimalCareOperation } from './wiqar/booking.animalCare.workflow.js';
import { LaunchAnimalFeedingOperation } from './wiqar/booking.animalFeeding.workflow.js';
import { LaunchPhotographyOperation } from './wiqar/booking.photography.workflow.js';
import { LaunchGroupPackageOperation } from './wiqar/booking.groupPackage.workflow.js';

export const wfOperators: Record<EngineKind, WorkflowOperator> = {
  SHOP_AND_DROP: LaunchShopDropOperation,
  MOBILITY: LaunchMobilityOperation,
  LAGOON: LaunchLagoonOperation,
  COTE_RESTAURANT: LaunchCoteOperation,
  HORSE_RIDING: LaunchHorseRidingOperation,
  EQUESTRIAN_LESSON: LaunchEquestrianLessonOperation,
  CAMEL_TOUR: LaunchCamelTourOperation,
  ANIMAL_CARE: LaunchAnimalCareOperation,
  ANIMAL_FEEDING: LaunchAnimalFeedingOperation,
  PHOTOGRAPHY: LaunchPhotographyOperation,
  GROUP_PACKAGE: LaunchGroupPackageOperation,
};

export function getOperator(engineKind: string): WorkflowOperator | null {
  return wfOperators[engineKind as EngineKind] ?? null;
}
