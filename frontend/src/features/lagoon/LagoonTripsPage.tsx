import { useTranslation } from 'react-i18next'
import { Ship, Users, Layers } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatCard, StatusBadge } from '@/components/ui'
import { LiveIndicator } from '@/components/LiveIndicator'
import { usePlanTrips, useTripBoard, useWaitingForBoats } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { formatDateTime } from '@/utils'

export function LagoonTripsPage() {
  const { t } = useTranslation(['agent', 'common'])
  const { data: waiting = [], isLoading, dataUpdatedAt, isFetching } = useWaitingForBoats()
  const { data: board } = useTripBoard(false)
  const plan = usePlanTrips()

  const people = waiting.reduce((sum, g) => sum + g.people, 0)
  const boats = waiting.reduce((sum, g) => sum + g.boatsNeeded, 0)

  const group = () =>
    plan.mutate(undefined, {
      onSuccess: (trips) => toast('success', t('trips.grouped'), t('trips.groupedDetail', { count: trips.length })),
      onError: (e) => toast('danger', t('trips.couldNotGroup'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
    })

  return (
    <div data-testid="lagoon-trips">
      <PageHeader
        title={t('trips.title')}
        subtitle={t('trips.subtitle')}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('trips.title') }]}
        actions={<LiveIndicator updatedAt={dataUpdatedAt} fetching={isFetching} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t('trips.waitingPeople')} value={people} icon={<Users size={18} />} tone={people ? 'warning' : 'neutral'} testId="trips-waiting-people" />
        <StatCard label={t('trips.boatsNeeded')} value={boats} icon={<Ship size={18} />} tone="info" testId="trips-boats-needed" />
        <StatCard label={t('trips.ready')} value={board?.ready.length ?? 0} tone="neutral" testId="trips-ready-count" />
        <StatCard label={t('trips.running')} value={board?.running.length ?? 0} tone={board?.running.length ? 'success' : 'neutral'} testId="trips-running-count" />
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <SectionTitle className="flex items-center gap-2"><Layers size={18} /> {t('trips.whoIsWaiting')}</SectionTitle>
          <Button onClick={group} loading={plan.isPending} disabled={!waiting.length} data-testid="trips-plan">
            <Ship size={16} /> {t('trips.group')}
          </Button>
        </div>

        {isLoading ? (
          <Spinner />
        ) : waiting.length === 0 ? (
          <EmptyState icon={<Ship size={24} />} title={t('trips.nobodyWaiting')} message={t('trips.nobodyWaitingHint')} />
        ) : (
          <div className="flex flex-col gap-3">
            {waiting.map((g) => (
              <div key={g.assetTypeId} className="lf-card p-3" data-testid={`trips-group-${g.assetTypeId}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy dark:text-dk-texthi">{g.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{t('trips.seatsEach', { seats: g.seats })}</Badge>
                    <Badge tone="warning">{t('trips.peopleWaiting', { count: g.people })}</Badge>
                    <Badge tone="neutral">{t('trips.boats', { count: g.boatsNeeded })}</Badge>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.bookings.map((b) => (
                    <span key={b._id} className="text-xs px-2 py-1 rounded-lg bg-canvas dark:bg-dk-elevated" data-testid={`trips-party-${b._id}`}>
                      {b.ref} · {b.people}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle className="mb-3">{t('trips.plannedTitle')}</SectionTitle>
        {!board || [...board.ready, ...board.running].length === 0 ? (
          <EmptyState icon={<Ship size={24} />} title={t('trips.noTrips')} message={t('trips.noTripsHint')} />
        ) : (
          <div className="flex flex-col gap-2" data-testid="trips-planned">
            {[...board.ready, ...board.running].map((trip) => (
              <div key={trip._id} className="lf-card p-3 flex flex-wrap items-center justify-between gap-3" data-testid={`trip-${trip._id}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-navy dark:text-dk-texthi">
                    {trip.ref} · {trip.assetTypeName}
                    {trip.assetUnitIdentifier ? ` · ${trip.assetUnitIdentifier}` : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {t('trips.aboard', { headcount: trip.headcount, seats: trip.seats })}
                    {trip.captainName ? ` · ${trip.captainName}` : ''}
                    {trip.stops.length ? ` · ${trip.stops[trip.stops.length - 1].name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted tabular-nums">{formatDateTime(new Date(trip.createdAt).getTime())}</span>
                  <StatusBadge status={trip.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
