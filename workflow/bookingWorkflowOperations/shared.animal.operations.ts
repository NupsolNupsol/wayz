import type { OperationResult, WorkflowContext } from '../shared/types.js';
import { UNIT_RESTING } from '../shared/status.js';

/**
 * What every animal experience does to the animal when it finishes.
 *
 * The counterpart to `shared.animal.validators.ts`: those refuse an animal that is not fit to
 * work, and these are what *make* it unfit for a while afterwards. Written once because the
 * welfare rule is one rule — seven experiences that each decided for themselves when a horse
 * had rested enough would be seven different answers to a question with one answer.
 */

/**
 * How long each species rests between sessions, in minutes.
 *
 * §11.1 requires the interval to be enforced and says the durations are *"TBD with veterinary
 * advisor"*. These are working defaults, not veterinary advice: they are here so the rule is
 * real and testable from day one, and the whole point of keeping them in one named constant is
 * that the advisor's numbers replace them in one edit rather than seven.
 *
 * Keyed by the asset type the animal belongs to, falling back to the longest interval — an
 * unrecognised species resting too long is a recoverable inconvenience, resting too little is
 * not.
 */
export const REST_MINUTES: Record<string, number> = {
  horse: 45,
  camel: 30,
  goat: 15,
  deer: 15,
};

export const DEFAULT_REST_MINUTES = 45;

/** The rest a particular animal is owed, from the kind of animal it is. */
export function restMinutesFor(assetTypeId: string | null | undefined): number {
  if (!assetTypeId) return DEFAULT_REST_MINUTES;
  const species = Object.keys(REST_MINUTES).find((s) => assetTypeId.toLowerCase().includes(s));
  return species ? REST_MINUTES[species] : DEFAULT_REST_MINUTES;
}

/**
 * Finishes a session and stands the animal down to rest.
 *
 * §7.3: *"System automatically sets status to 'Resting' after session completion"*, and §11.1:
 * *"trainer cannot override without supervisor authentication"* — which is why the animal is
 * put into `RESTING` by the workflow rather than by anybody's decision at the counter. There
 * is no payload flag that skips it.
 *
 * Deliberately **not** `completeAndRelease`: releasing an animal straight back to `AVAILABLE`
 * is exactly the behaviour the welfare rule exists to prevent. A boat can go straight out
 * again; a horse cannot.
 */
export function completeAndRest(result: OperationResult, ctx: WorkflowContext): void {
  result.booking.session.chargeableEndedAt = ctx.now.toISOString();

  const unitId = result.booking.assetUnitId;
  if (!unitId) return;

  const assetTypeId =
    ctx.assets.byId[unitId]?.assetTypeId ??
    (ctx.booking.metadata?.assetTypeId as string | undefined);
  const minutes = restMinutesFor(assetTypeId);
  const until = new Date(ctx.now.getTime() + minutes * 60_000);

  result.assetIntents.push({
    op: 'SET_STATUS',
    unitId,
    status: UNIT_RESTING,
    currentBookingId: null,
    // Read back by the screens that explain why an animal cannot be booked yet.
    note: `Resting until ${until.toISOString()} (${minutes} min after ${result.booking.ref}).`,
    // Machine-readable, so the session sweep can put the animal back to work when this passes.
    restingUntil: until.toISOString(),
  });

  result.booking.metadata = {
    ...result.booking.metadata,
    restingUntil: until.toISOString(),
    restMinutes: minutes,
  };
}

/**
 * Records who ran the session on the booking itself.
 *
 * §11.1 requires a named trainer, and §10.2's user stories want to see afterwards who it was.
 * Copied onto the booking rather than left in the payload so it survives on the record the
 * accountant and the supervisor read later.
 */
export function recordHandler(result: OperationResult, ctx: WorkflowContext): void {
  const named =
    (typeof ctx.payload.trainerId === 'string' && ctx.payload.trainerId.trim()) ||
    (typeof ctx.booking.metadata?.trainerId === 'string' &&
      (ctx.booking.metadata.trainerId as string).trim());

  if (named) result.booking.metadata = { ...result.booking.metadata, trainerId: named };
}
