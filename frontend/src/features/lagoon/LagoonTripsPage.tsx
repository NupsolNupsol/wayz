import { useTranslation } from 'react-i18next'
import { Anchor, Ship, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatCard, StatusBadge } from '@/components/ui'
import { LiveIndicator } from '@/components/LiveIndicator'
import { useBoatsWithRoom, useReleaseTrip, useTripBoard } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'

export function LagoonTripsPage() {
  const { t } = useTranslation(['agent', 'common'])
  const { data: boats = [], isLoading, dataUpdatedAt, isFetching } = useBoatsWithRoom()
  const { data: board } = useTripBoard()
  const release = useReleaseTrip()

  const filling = board?.filling ?? []
  const ready = board?.ready ?? []
  const sailing = (board?.running ?? []).filter((trip) => trip.status === 'RUNNING')
  const seated = boats.reduce((sum, b) => sum + b.taken, 0)

  const send = (id: string, ref: string) =>
    release.mutate(id, {
      onSuccess: () => toast('success', t('trips.released'), t('trips.releasedDetail', { ref })),
      onError: (e) => toast('danger', t('trips.didNotGo'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
    })

  return (
    <div data-testid="lagoon-trips">
      <PageHeader
        title={t('trips.title')}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('trips.title') }]}
        helpId="lagoon-trips"
        actions={<LiveIndicator updatedAt={dataUpdatedAt} fetching={isFetching} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t('trips.seated')} value={seated} icon={<Users size={18} />} tone="info" testId="trips-seated" />
        <StatCard label={t('trips.fillingNow')} value={filling.length} icon={<Ship size={18} />} tone="neutral" testId="trips-filling-count" />
        <StatCard label={t('trips.waitingForACaptain')} value={ready.length} icon={<Anchor size={18} />} tone="warning" testId="trips-ready-count" />
        <StatCard label={t('trips.outOnTheWater')} value={sailing.length} icon={<Ship size={18} />} tone="success" testId="trips-sailing-count" />
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <Card className="lg:col-span-2">
            <SectionTitle className="mb-1">{t('trips.boats')}</SectionTitle>
            <p className="text-sm text-muted mb-3">{t('trips.boatsHint')}</p>

            {boats.length === 0 ? (
              <EmptyState icon={<Ship size={24} />} title={t('trips.noBoats')} message={t('trips.noBoatsHint')} />
            ) : (
              <div className="flex flex-col gap-2" data-testid="trips-boats">
                {boats.map((boat) => {
                  const trip = filling.find((f) => f._id === boat.tripId) ?? null
                  const pct = Math.round((boat.taken / boat.seats) * 100)
                  return (
                    <div
                      key={boat._id}
                      className={clsx('lf-card p-3', boat.status === 'FULL' && 'border-success/50 bg-emerald-50/60 dark:bg-emerald-900/15')}
                      data-testid={`trips-boat-${boat._id}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-navy dark:text-dk-texthi">
                            {boat.identifier} · {boat.assetTypeName}
                          </p>
                          <p className="text-xs text-muted">
                            {t('trips.seatsLeft', { free: boat.free, seats: boat.seats })}
                            {boat.tripRef ? ` · ${boat.tripRef}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={boat.status === 'FULL' ? 'success' : boat.status === 'FILLING' ? 'info' : 'neutral'} testId={`trips-boat-state-${boat._id}`}>
                            {t(`trips.boatState.${boat.status}`)}
                          </Badge>
                          {trip && boat.taken > 0 && (
                            <Button
                              variant="secondary"
                              className="!h-8 !px-3 text-xs"
                              loading={release.isPending}
                              onClick={() => send(trip._id, trip.ref)}
                              data-testid={`trips-release-${trip._id}`}
                            >
                              {t('trips.sendItNow')}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-line dark:bg-dk-border mt-2 overflow-hidden">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-5">
            <Card>
              <SectionTitle className="mb-3">{t('trips.waitingForACaptain')}</SectionTitle>
              {ready.length === 0 ? (
                <p className="text-sm text-muted" data-testid="trips-none-ready">{t('trips.noneReady')}</p>
              ) : (
                <div className="flex flex-col gap-2" data-testid="trips-planned">
                  {ready.map((trip) => (
                    <div key={trip._id} className="lf-card p-3" data-testid={`trips-ready-${trip._id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-navy dark:text-dk-texthi">
                          {trip.ref} · {trip.assetUnitIdentifier ?? trip.assetTypeName}
                        </p>
                        <StatusBadge status={trip.status} />
                      </div>
                      <p className="text-xs text-muted mt-0.5">{t('trips.aboard', { headcount: trip.headcount, seats: trip.seats })}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle className="mb-3">{t('trips.outOnTheWater')}</SectionTitle>
              {sailing.length === 0 ? (
                <p className="text-sm text-muted" data-testid="trips-none-sailing">{t('trips.noneSailing')}</p>
              ) : (
                <div className="flex flex-col gap-2" data-testid="trips-sailing">
                  {sailing.map((trip) => (
                    <div key={trip._id} className="lf-card p-3" data-testid={`trips-sailing-${trip._id}`}>
                      <p className="font-semibold text-sm text-navy dark:text-dk-texthi">
                        {trip.ref} · {trip.assetUnitIdentifier ?? trip.assetTypeName}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {trip.captainName ? `${trip.captainName} · ` : ''}
                        {t('trips.stopsClocked', { count: trip.stops.length })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
