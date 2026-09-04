import { useTranslation } from 'react-i18next'
import { Anchor, MapPin, Ship, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Card, EmptyState, Spinner, StatusBadge } from '@/components/ui'
import { useTripBoard } from '@/hooks'
import { formatDateTime } from '@/utils'

export function CaptainHistoryPage() {
  const { t } = useTranslation(['agent', 'common'])
  const { data: board, isLoading } = useTripBoard(true)
  const done = board?.done ?? []

  return (
    <div data-testid="captain-history">
      <PageHeader title={t('trips.completed')} crumbs={[{ label: t('trips.captainTitle'), to: '/lagoon/captain' }, { label: t('trips.completed') }]} />

      {isLoading ? (
        <Spinner />
      ) : done.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<Anchor size={26} />} title={t('trips.noneFinished')} message={t('trips.noneFinishedHint')} />
        </Card>
      ) : (
        <div className="flex flex-col gap-3" data-testid="captain-history-list">
          {done.map((trip) => (
            <Card key={trip._id} className="p-4" data-testid={`captain-done-${trip._id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-navy dark:text-dk-texthi">
                    {trip.ref} · {trip.assetTypeName}
                    {trip.assetUnitIdentifier ? ` · ${trip.assetUnitIdentifier}` : ''}
                  </p>
                  <p className="text-sm text-muted flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} /> {t('trips.aboard', { headcount: trip.headcount, seats: trip.seats })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Ship size={14} /> {formatDateTime(trip.startedAt ? new Date(trip.startedAt).getTime() : null)}
                    </span>
                  </p>
                </div>
                <StatusBadge status={trip.status} />
              </div>

              {trip.stops.length > 0 && (
                <ol className="flex flex-wrap items-center gap-1.5 mt-3" data-testid={`captain-done-stops-${trip._id}`}>
                  {trip.stops.map((stop, i) => (
                    <li key={`${stop.stationId}-${i}`}>
                      <Badge tone="neutral">
                        <MapPin size={11} className="me-1 inline" />
                        {stop.name}
                      </Badge>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
