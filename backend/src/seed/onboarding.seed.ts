import { LearningProgress, User } from '../models/index.js';
import { tourKeyFor } from '../services/learning/learning.service.js';
import type { Role } from '../domain/types.js';
import { requireOrganisation, runAcrossOrganisations } from '../platform/orgScope.js';

/**
 * Marks seeded accounts as having already been shown the guided tour.
 *
 * The tour is a full-screen overlay that starts itself for anybody whose onboarding is still
 * `PENDING` — which is right for a real new employee and wrong for a demonstration account
 * that ships with the system. Without this, every seeded person signs in behind an overlay
 * they did not ask for, and the application is unreachable underneath until it is dismissed.
 *
 * It is not hidden, only not forced: the training page offers "restart the tour" to anybody
 * who wants it, which is also how the end-to-end suite exercises it.
 *
 * Idempotent, and deliberately does not touch a row that already exists — somebody part way
 * through a tour keeps their place.
 */
export async function markSeededAccountsOnboarded(): Promise<number> {
  const people = await User.find({}, { _id: 1, role: 1 }).lean<{ _id: string; role: Role }[]>();
  if (people.length === 0) return 0;

  const organizationId = requireOrganisation();

  /*
   * Upserted by primary key, and asked globally.
   *
   * A progress row's `_id` *is* the user's id, so it is unique across the whole collection
   * rather than within one organisation. Asking the scoped question — "does this organisation
   * have a row for this person?" — misses a row written before scoping existed, and the insert
   * that follows then collides on a primary key the query said was free.
   *
   * `$setOnInsert` also means somebody part way through a tour keeps their place: an existing
   * row, however it got there, is left exactly as it is.
   */
  const written = await runAcrossOrganisations(async () => {
    const results = await Promise.all(
      people.map((p) =>
        LearningProgress.updateOne(
          { _id: p._id },
          {
            $setOnInsert: {
              tenantId: organizationId,
              tourKey: tourKeyFor(p.role),
              role: p.role,
              status: 'COMPLETED',
              stepIndex: 0,
              completedSteps: [],
              restarts: 0,
            },
          },
          { upsert: true }
        )
      )
    );
    return results.filter((r) => r.upsertedCount > 0).length;
  });

  return written;
}
