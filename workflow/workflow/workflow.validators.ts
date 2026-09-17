import type { EngineKind, WorkflowValidator } from '../shared/types.js';
import { LaunchShopDropControl } from './booking.shopdrop.workflow.js';
import { LaunchMobilityControl } from './booking.mobility.workflow.js';
import { LaunchLagoonControl } from './booking.lagoon.workflow.js';
import { LaunchCoteControl } from './booking.cote.workflow.js';
import { LaunchHorseRidingControl } from './wiqar/booking.horseRiding.workflow.js';
import { LaunchEquestrianLessonControl } from './wiqar/booking.equestrianLesson.workflow.js';
import { LaunchCamelTourControl } from './wiqar/booking.camelTour.workflow.js';
import { LaunchAnimalCareControl } from './wiqar/booking.animalCare.workflow.js';
import { LaunchAnimalFeedingControl } from './wiqar/booking.animalFeeding.workflow.js';
import { LaunchPhotographyControl } from './wiqar/booking.photography.workflow.js';
import { LaunchGroupPackageControl } from './wiqar/booking.groupPackage.workflow.js';

export const wfValidators: Record<EngineKind, WorkflowValidator> = {
  SHOP_AND_DROP: LaunchShopDropControl,
  MOBILITY: LaunchMobilityControl,
  LAGOON: LaunchLagoonControl,
  COTE_RESTAURANT: LaunchCoteControl,
  HORSE_RIDING: LaunchHorseRidingControl,
  EQUESTRIAN_LESSON: LaunchEquestrianLessonControl,
  CAMEL_TOUR: LaunchCamelTourControl,
  ANIMAL_CARE: LaunchAnimalCareControl,
  ANIMAL_FEEDING: LaunchAnimalFeedingControl,
  PHOTOGRAPHY: LaunchPhotographyControl,
  GROUP_PACKAGE: LaunchGroupPackageControl,
};

export function getValidator(engineKind: string): WorkflowValidator | null {
  return wfValidators[engineKind as EngineKind] ?? null;
}
