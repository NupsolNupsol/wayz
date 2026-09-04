import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Anchor, Flag, MapPinned, Route, Ship, Trash2, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatusBadge } from '@/components/ui'
import { LiveIndicator } from '@/components/LiveIndicator'
import { StationMap, type MapPoint } from '@/components/StationMap'
import { toneFor } from '@/components/mapMarkers'
import { useClockStation, useCompleteTrip, useSetTripRoute, useStartTrip, useTrip, useTripBoard } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { formatDateTime } from '@/utils'

export function CaptainVoyagePage() {
  const { t } = useTranslation(['agent', 'common'])
  const { data: board, isLoading, dataUpdatedAt, isFetching } = useTripBoard(true)
  const setRoute = useSetTripRoute()
  const clock = useClockStation()
  const start = useStartTrip()
  const finish = useCompleteTrip()

  const mine = useMemo(() => {
    const carrying = board?.running ?? []
    const sailing = carrying.filter((trip) => trip.status === 'RUNNING')
    if (sailing.length) return sailing[sailing.length - 1]
    const claimed = carrying.filter((trip) => trip.status === 'CLAIMED')
    return claimed.length ? claimed[claimed.length - 1] : null
  }, [board])
  const { data: detail } = useTrip(mine?._id)
  const trip = detail?.trip ?? mine
  const points: MapPoint[] = detail?.stations ?? []

  const [draft, setDraft] = useState<string[] | null>(null)
  useEffect(() => setDraft(null), [trip?._id])

  const saved = (trip?.route ?? []).map((leg) => leg.stationId)
  const plan = draft ?? saved
  const reached = (trip?.stops ?? []).map((stop) => stop.stationId)
  const dirty = draft !== null && draft.join('|') !== saved.join('|')

  const fail = (e: unknown) => toast('danger', t('trips.didNotGo'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')

  const at = new Map(points.filter((p) => p.mapX !== null && p.mapY !== null).map((p) => [p._id, p]))
  const lastReached = reached.length ? at.get(reached[reached.length - 1]) : null
  const nextStopId = plan.find((id) => !reached.includes(id)) ?? null
  const nextStop = nextStopId ? at.get(nextStopId) : null

  const home = trip?.kioskId ? at.get(trip.kioskId) : null
  const berth = lastReached ?? home ?? (trip?.stationId ? at.get(trip.stationId) : null)
  const boat =
    trip?.status === 'RUNNING'
      ? {
          x: berth?.mapX ?? 0.5,
          y: berth?.mapY ?? 0.5,
          label: `${trip.assetUnitIdentifier ?? trip.ref}${berth ? ` · ${berth.name}` : ''}`,
        }
      : null

  const toggle = (point: MapPoint) => {
    if (reached.includes(point._id)) return
    setDraft((prev) => {
      const base = prev ?? saved
      return base.includes(point._id) ? base.filter((id) => id !== point._id) : [...base, point._id]
    })
  }

  const commitRoute = () => {
    if (!trip) return
    setRoute.mutate(
      { id: trip._id, stationIds: plan },
      {
        onSuccess: () => {
          setDraft(null)
          toast('success', t('voyage.routeSaved'), t('voyage.routeSavedDetail', { count: plan.length }))
        },
        onError: fail,
      },
    )
  }

  const reach = (stationId: string, name: string) => {
    if (!trip) return
    clock.mutate({ id: trip._id, stationId }, { onSuccess: () => toast('success', t('trips.reached', { name })), onError: fail })
  }

  if (isLoading) {
    return (
      <div data-testid="captain-voyage">
        <PageHeader title={t('voyage.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  return (
    <div data-testid="captain-voyage">
      <PageHeader
        title={t('voyage.title')}
        subtitle={t('voyage.subtitle')}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('voyage.title') }]}
        actions={<LiveIndicator updatedAt={dataUpdatedAt} fetching={isFetching} />}
      />

      {!trip ? (
        <Card className="p-6">
          <EmptyState icon={<Anchor size={26} />} title={t('voyage.noTrip')} message={t('voyage.noTripHint')} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <SectionTitle className="flex items-center gap-2">
                <MapPinned size={18} className="text-brand" /> {t('voyage.chart')}
              </SectionTitle>
              <div className="flex items-center gap-2">
                <StatusBadge status={trip.status} />
                <Badge tone="neutral" testId="voyage-boat">
                  <Ship size={12} className="me-1 inline" />
                  {trip.assetUnitIdentifier ?? trip.assetTypeName}
                </Badge>
              </div>
            </div>

            <StationMap
              points={points}
              route={plan}
              reachedIds={reached}
              boat={boat}
              selectedId={nextStopId}
              onPick={toggle}
              testId="voyage-map"
            >
              {points.every((p) => p.mapX === null) && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-muted px-8 text-center pointer-events-none" data-testid="voyage-map-empty">
                  {t('voyage.noMapYet')}
                </p>
              )}
            </StationMap>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <p className="text-xs text-muted">{t('voyage.pickHint')}</p>
              <div className="flex items-center gap-2">
                {dirty && (
                  <Button variant="ghost" onClick={() => setDraft(null)} data-testid="voyage-route-reset">
                    <Trash2 size={15} /> {t('voyage.reset')}
                  </Button>
                )}
                <Button onClick={commitRoute} loading={setRoute.isPending} disabled={!dirty} data-testid="voyage-route-save">
                  <Route size={15} /> {t('voyage.saveRoute')}
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <SectionTitle className="mb-1">{trip.ref}</SectionTitle>
              <p className="text-sm text-muted flex items-center gap-1.5 mb-3">
                <Users size={14} /> {t('trips.aboard', { headcount: trip.headcount, seats: trip.seats })}
              </p>

              {trip.status === 'CLAIMED' && plan.length === 0 && (
                <p className="text-sm text-muted mb-3" data-testid="voyage-need-road">
                  {t('voyage.roadFirst')}
                </p>
              )}

              {trip.status === 'CLAIMED' && (
                <Button
                  className="w-full"
                  disabled={plan.length === 0 || dirty}
                  title={plan.length === 0 ? t('voyage.roadFirst') : dirty ? t('voyage.saveFirst') : undefined}
                  loading={start.isPending}
                  onClick={() =>
                    start.mutate(
                      { id: trip._id },
                      {
                        onSuccess: (sailing) => toast('success', t('trips.started'), t('trips.startedDetail', { boat: sailing.assetUnitIdentifier ?? '' })),
                        onError: fail,
                      },
                    )
                  }
                  data-testid="voyage-start"
                >
                  <Ship size={16} /> {t('trips.start')}
                </Button>
              )}

              {trip.status === 'RUNNING' && nextStop && (
                <Button
                  className="w-full"
                  loading={clock.isPending}
                  onClick={() => reach(nextStop._id, nextStop.name)}
                  data-testid="voyage-reach-next"
                >
                  <Flag size={16} /> {t('voyage.reachedNext', { name: nextStop.name })}
                </Button>
              )}

              {trip.status === 'RUNNING' && !nextStop && (
                <Button
                  className="w-full"
                  loading={finish.isPending}
                  onClick={() =>
                    finish.mutate(trip._id, {
                      onSuccess: () => toast('success', t('trips.finished'), t('trips.finishedDetail', { ref: trip.ref })),
                      onError: fail,
                    })
                  }
                  data-testid="voyage-complete"
                >
                  <Flag size={16} /> {t('trips.finishTrip')}
                </Button>
              )}
            </Card>

            <Card className="p-4">
              <SectionTitle className="mb-3">{t('voyage.plan')}</SectionTitle>
              {plan.length === 0 ? (
                <p className="text-sm text-muted" data-testid="voyage-no-plan">{t('voyage.nothingPlanned')}</p>
              ) : (
                <ol className="flex flex-col gap-1.5" data-testid="voyage-plan">
                  {plan.map((id, i) => {
                    const point = at.get(id)
                    const done = reached.includes(id)
                    const isNext = id === nextStopId && trip.status === 'RUNNING'
                    const stop = (trip.stops ?? []).find((s) => s.stationId === id)
                    return (
                      <li
                        key={id}
                        className={clsx(
                          'flex items-center gap-2.5 rounded-lg px-2 py-1.5',
                          isNext && 'bg-brand/10',
                          done && 'opacity-70',
                        )}
                        data-testid={`voyage-leg-${id}`}
                      >
                        <span
                          className={clsx(
                            'w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 text-white',
                            done ? 'bg-success' : isNext ? 'bg-brand' : 'bg-slate-400',
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-navy dark:text-dk-texthi truncate">
                            {point?.name ?? (trip.route ?? []).find((leg) => leg.stationId === id)?.name ?? id}
                          </span>
                          {stop && (
                            <span className="block text-[11px] text-muted">{formatDateTime(new Date(stop.at).getTime())}</span>
                          )}
                        </span>
                        {trip.status === 'RUNNING' && !done && (
                          <Button
                            variant="secondary"
                            className="!h-8 !px-2.5"
                            loading={clock.isPending}
                            onClick={() => reach(id, point?.name ?? id)}
                            data-testid={`voyage-clock-${id}`}
                          >
                            {t('voyage.reached')}
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </Card>

            <Card className="p-4">
              <SectionTitle className="mb-3">{t('voyage.stops')}</SectionTitle>
              {points.length === 0 ? (
                <p className="text-sm text-muted">{t('voyage.noStops')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5" data-testid="voyage-stop-picker">
                  {points.map((point) => {
                    const picked = plan.includes(point._id)
                    return (
                      <button
                        key={point._id}
                        type="button"
                        onClick={() => toggle(point)}
                        disabled={reached.includes(point._id)}
                        className={clsx(
                          'lf-btn !h-8 !px-2.5 text-xs border',
                          picked ? 'bg-brand text-brand-fg border-brand' : 'bg-surface border-line text-muted hover:text-brand',
                        )}
                        data-testid={`voyage-pick-${point._id}`}
                      >
                        <span className={clsx('w-2 h-2 rounded-full', toneFor(point))} />
                        {point.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
