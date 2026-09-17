import { Booking, Incident, Payment } from '../models/index.js';

import type { Scope } from '../interfaces/index.js';
import { adoptedActivities } from '../platform/activityCatalogue.js';
import { allowedEngines, engineFilter } from '../domain/access.js';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function dashboardStats(scope: Scope) {
  const engines = engineFilter(scope);
  const base = {
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    ...(engines === undefined ? {} : { engineKind: engines }),
  };
  const now = new Date();
  const soon = new Date(now.getTime() + 45 * 60_000);

  const [
    todaysTransactions,
    revenueAgg,
    activeOperations,
    storedBagsAgg,
    dueSoon,
    overdue,
    pendingRetrievals,
    openIncidents,
    byEngineAgg,
  ] = await Promise.all([
    Payment.distinct('orderId', {
      ...base,
      kind: 'SALE',
      createdAt: { $gte: startOfToday() },
    }).then((ids) => ids.length),
    Payment.aggregate([
      {
        $match: {
          ...base,
          kind: { $in: ['SALE', 'OVERTIME'] },
          status: 'CAPTURED',
          createdAt: { $gte: startOfToday() },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Booking.countDocuments({
      ...base,
      status: { $in: ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS'] },
    }),
    Booking.aggregate([
      { $match: { ...base } },
      { $unwind: '$bags' },
      { $match: { 'bags.status': 'STORED' } },
      { $count: 'n' },
    ]),
    Booking.countDocuments({
      ...base,
      status: { $in: ['ACTIVE', 'OVERTIME'] },
      'session.expectedEndAt': { $gt: now, $lt: soon },
    }),
    Booking.countDocuments({
      ...base,
      status: { $in: ['ACTIVE', 'OVERTIME'] },
      'session.expectedEndAt': { $lt: now },
    }),
    Booking.countDocuments({ ...base, status: 'RETRIEVAL_IN_PROGRESS' }),
    Incident.countDocuments({ ...base, status: { $nin: ['RESOLVED', 'REJECTED'] } }),
    Booking.aggregate([
      { $match: { ...base } },
      { $group: { _id: '$engineKind', count: { $sum: 1 } } },
    ]),
  ]);

  const byEngineMap = new Map<string, number>(
    byEngineAgg.map((e: { _id: string; count: number }) => [e._id, e.count])
  );
  const adopted = await adoptedActivities();

  return {
    todaysTransactions,
    todaysRevenue: Math.round((revenueAgg[0]?.total ?? 0) * 100) / 100,
    activeOperations,
    storedBags: storedBagsAgg[0]?.n ?? 0,
    dueSoon,
    overdue,
    pendingRetrievals,
    openIncidents,
    /*
     * The activities this person works, or failing that the ones their organisation runs.
     *
     * The fallback used to be the platform's whole catalogue, which was harmless while there
     * was one organisation and became wrong the moment there were two: an administrator whose
     * role is not activity-scoped would see every registered activity on their dashboard,
     * including seven belonging to a company they have never heard of, each reading zero.
     */
    byEngine: (allowedEngines(scope) ?? adopted).map((k) => ({
      engineKind: k,
      count: byEngineMap.get(k) ?? 0,
    })),
  };
}
