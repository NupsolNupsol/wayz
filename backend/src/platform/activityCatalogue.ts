import { allEnginesWorkflow } from '../domain/workflow.js';
import { ACTIVITY_LABELS } from '../constants/labels.constants.js';
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js';
import { Tenant } from '../models/index.js';
import { requireOrganisation } from './orgScope.js';
import { ApiError } from '../utils/ApiError.js';
import type { BilingualLabel } from '../interfaces/accounting.interface.js';

/**
 * Every activity the platform can run, and which organisations have taken them up.
 *
 * An activity is a **coded module**: a workflow with its own states, transitions, validators
 * and operators, registered once in `@wayz/workflow`. Shop & Drop, Mobility and Lagoon are
 * three of them; anything added later is another, written the same way.
 *
 * This file is the seam between "what the platform can do" and "what this company does". The
 * catalogue is global and identical for everyone. Adoption is per organisation, and is the
 * only thing that differs — which is what lets one backend, one frontend and one set of
 * screens serve every organisation without a single `if (organisation === …)`.
 *
 * ## The three questions, and who answers them
 *
 * | Question | Answered by |
 * |---|---|
 * | What activities exist? | this catalogue — the code |
 * | Which does this company run? | `Tenant.enabledEngines` — its administrator |
 * | Which does this employee work? | `User.engineKinds` — their manager |
 *
 * Each narrows the one before it, and nothing may skip a step: an employee cannot be assigned
 * an activity their organisation has not adopted, and an organisation cannot adopt one the
 * platform does not implement.
 */

export interface CatalogueEntry {
  key: EngineKind;
  label: BilingualLabel;
  /** What a tenant administrator reads when deciding whether to take it up. */
  description: string;
  /** The kind of thing it runs on — what its resources are. */
  assetKind: string;
  /** The shape of one unit of work: a storage, a rental, an outing. */
  sessionKind: string;
  /** The jobs its workflow admits, so an adoption page can say who would staff it. */
  actors: string[];
}

const DESCRIPTIONS: Record<EngineKind, string> = {
  SHOP_AND_DROP: 'Customers leave bags at a counter and collect them from a locker at a gate.',
  MOBILITY: 'Scooters, carts and wheelchairs hired out by the hour or by the day.',
  LAGOON: 'Boat trips sold by the seat, run by a captain and timed by the voyage.',
  COTE_RESTAURANT: 'Table service — a cover is seated, served and settled.',
  HORSE_RIDING: 'A guided trail ride on an Arabian horse, escorted by a trainer.',
  EQUESTRIAN_LESSON:
    'A structured riding lesson from a certified trainer, beginner or intermediate.',
  CAMEL_TOUR: 'A guided camel walk within the grounds, led on foot by a handler.',
  ANIMAL_CARE: 'The visitor grooms and showers their assigned horse, guided by a trainer.',
  ANIMAL_FEEDING: 'The visitor buys feed and gives it to an animal under supervision.',
  PHOTOGRAPHY: 'A studio photography session with an animal, delivered digitally or printed.',
  GROUP_PACKAGE:
    'A camel tour, a feeding and a photo session sold together to a party of five or more.',
};

/**
 * The catalogue, derived from the workflow registry rather than written out beside it.
 *
 * So an activity exists here *because* somebody implemented its workflow, and cannot be
 * offered to an organisation that would then find nothing behind it.
 */
export function listCatalogue(): CatalogueEntry[] {
  return ENGINE_KINDS.filter((key) => allEnginesWorkflow[key]).map((key) => {
    const wf = allEnginesWorkflow[key];
    return {
      key,
      label: ACTIVITY_LABELS[key],
      description: DESCRIPTIONS[key],
      assetKind: wf.assetKind,
      sessionKind: wf.sessionKind,
      actors: [...wf.actors],
    };
  });
}

const CATALOGUE_KEYS = new Set<string>(listCatalogue().map((e) => e.key));

export function isRegisteredActivity(key: string): key is EngineKind {
  return CATALOGUE_KEYS.has(key);
}

/**
 * The activities this organisation has taken up.
 *
 * Addressed by id, deliberately. The organisation document *is* the organisation — it is
 * identified by `_id` and carries no `tenantId`, so it is exempt from the automatic scoping
 * every other collection gets. `findOne({})` therefore returns whichever organisation happens
 * to be first in the collection, which is how WIQAR came to be told it ran WAYZ's activities.
 */
export async function adoptedActivities(): Promise<EngineKind[]> {
  const organisation = await Tenant.findById(requireOrganisation(), { enabledEngines: 1 }).lean<{
    enabledEngines?: EngineKind[];
  } | null>();
  return organisation?.enabledEngines ?? [];
}

/**
 * Sets which activities this organisation runs.
 *
 * Refuses anything the platform does not implement — an unknown key would otherwise be
 * accepted, appear on the employee form, and fail at the counter with nothing to explain it.
 *
 * Dropping an activity deliberately does **not** touch the people or the resources already
 * attached to it. An administrator who un-adopts something by mistake should be able to put it
 * back and find their world intact; cascading the removal would make that impossible, and the
 * stale assignments are invisible anyway because every screen reads the adopted list.
 */
export async function adoptActivities(keys: string[]): Promise<EngineKind[]> {
  const wanted = [...new Set(keys)];

  const unknown = wanted.filter((k) => !isRegisteredActivity(k));
  if (unknown.length) {
    throw ApiError.badRequest(`The platform has no activity called "${unknown[0]}".`, [
      `Registered activities: ${[...CATALOGUE_KEYS].join(', ')}.`,
    ]);
  }

  // By id, for the same reason `adoptedActivities` is — see the note there.
  const organisation = await Tenant.findById(requireOrganisation());
  if (!organisation) throw ApiError.notFound('This organisation has no record to configure.');

  organisation.enabledEngines = wanted as EngineKind[];
  await organisation.save();
  return organisation.enabledEngines;
}

/**
 * Refuses an activity this organisation has not adopted.
 *
 * Called wherever somebody is *given* an activity — hiring, reassignment, building a counter.
 * The adoption list is the one place that decides, so the check is the same everywhere and
 * says the same thing.
 */
export async function assertAdopted(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const adopted = await adoptedActivities();
  const missing = keys.filter((k) => !adopted.includes(k as EngineKind));
  if (missing.length) {
    throw ApiError.badRequest(
      `This organisation does not run ${ACTIVITY_LABELS[missing[0] as EngineKind]?.en ?? missing[0]}.`,
      ['An administrator adopts an activity before anybody can be assigned to it.']
    );
  }
}
