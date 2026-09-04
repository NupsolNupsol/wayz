import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Anchor, Flag, MapPin, Ship, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatusBadge } from '@/components/ui'
import { LiveIndicator } from '@/components/LiveIndicator'
import { useClaimTrip, useClockStation, useCompleteTrip, useTrip, useTripBoard } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { formatDateTime } from '@/utils'

export function CaptainBoardPage() {
  const { t } = useTranslation(['agent', 'common'])
  const { data: board, isLoading, dataUpdatedAt, isFetching } = useTripBoard(true)
  const claim = useClaimTrip()
  const clock = useClockStation()
  const finish = useCompleteTrip()
  const [openId, setOpenId] = useState<string | null>(null)
  const navigate = useNavigate()

  const mine = (board?.running ?? []).find((trip) => trip.status === 'RUNNING') ?? null
  const claimed = (board?.running ?? []).filter((trip) => trip.status === 'CLAIMED')
  const { data: detail } = useTrip(mine?._id ?? openId ?? undefined)

  const fail = (e: unknown) => toast('danger', t('trips.didNotGo'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')

  return (
    <div data-testid="captain-board">
      <PageHeader
        title={t('trips.captainTitle')}
        subtitle={t('trips.captainSubtitle')}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('trips.captainTitle') }]}
        actions={<LiveIndicator updatedAt={dataUpdatedAt} fetching={isFetching} />}
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <Card className="lg:col-span-2">
            <SectionTitle className="mb-3 flex items-center gap-2"><Ship size={18} /> {t('trips.myTrip')}</SectionTitle>
            {!mine ? (
              <EmptyState icon={<Anchor size={24} />} title={t('trips.nothingUnderway')} message={t('trips.nothingUnderwayHint')} />
            ) : (
              <div data-testid="captain-current-trip">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-navy dark:text-dk-texthi">
                      {mine.ref} · {mine.assetTypeName}
                      {mine.assetUnitIdentifier ? ` · ${mine.assetUnitIdentifier}` : ''}
                    </p>
                    <p className="text-sm text-muted flex items-center gap-1.5">
                      <Users size={14} /> {t('trips.aboard', { headcount: mine.headcount, seats: mine.seats })}
                    </p>
                  </div>
                  <StatusBadge status={mine.status} />
                </div>

                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">{t('trips.route')}</p>
                  {mine.stops.length === 0 ? (
                    <p className="text-sm text-muted" data-testid="captain-no-stops">{t('trips.noStopsYet')}</p>
                  ) : (
                    <ol className="flex flex-col gap-1.5" data-testid="captain-stops">
                      {mine.stops.map((stop, i) => (
                        <li key={`${stop.stationId}-${i}`} className="flex items-center gap-2 text-sm">
                          <MapPin size={14} className="text-brand" />
                          <span className="font-medium">{stop.name}</span>
                          <span className="text-xs text-muted tabular-nums">{formatDateTime(new Date(stop.at).getTime())}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">{t('trips.clockAStation')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(detail?.stations ?? []).map((station) => (
                      <Button
                        key={station._id}
                        variant="secondary"
                        loading={clock.isPending}
                        onClick={() =>
                          clock.mutate(
                            { id: mine._id, stationId: station._id },
                            { onSuccess: () => toast('success', t('trips.reached', { name: station.name })), onError: fail },
                          )
                        }
                        data-testid={`captain-clock-${station._id}`}
                      >
                        <MapPin size={15} /> {station.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-line">
                  <Button
                    onClick={() =>
                      finish.mutate(mine._id, {
                        onSuccess: () => toast('success', t('trips.finished'), t('trips.finishedDetail', { ref: mine.ref })),
                        onError: fail,
                      })
                    }
                    loading={finish.isPending}
                    data-testid="captain-complete"
                  >
                    <Flag size={16} /> {t('trips.finishTrip')}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-5">
            {claimed.length > 0 && (
              <Card>
                <SectionTitle className="mb-3">{t('trips.readyToCastOff')}</SectionTitle>
                {claimed.map((trip) => (
                  <div key={trip._id} className="flex flex-wrap items-center justify-between gap-2 mb-2" data-testid={`captain-claimed-${trip._id}`}>
                    <p className="text-sm font-semibold">{trip.ref} · {trip.assetTypeName}</p>
                    <Button onClick={() => navigate('/lagoon/voyage')} data-testid={`captain-start-${trip._id}`}>
                      <Ship size={15} /> {t('trips.planTheRoad')}
                    </Button>
                  </div>
                ))}
              </Card>
            )}

            <Card>
              <SectionTitle className="mb-3">{t('trips.waitingForACaptain')}</SectionTitle>
              {(board?.ready ?? []).length === 0 ? (
                <p className="text-sm text-muted" data-testid="captain-no-ready">{t('trips.noneReady')}</p>
              ) : (
                <div className="flex flex-col gap-2" data-testid="captain-ready">
                  {(board?.ready ?? []).map((trip) => (
                    <div key={trip._id} className="lf-card p-3" data-testid={`captain-trip-${trip._id}`}>
                      <p className="font-semibold text-sm">{trip.ref} · {trip.assetTypeName}</p>
                      <p className="text-xs text-muted mb-2">{t('trips.aboard', { headcount: trip.headcount, seats: trip.seats })}</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {trip.passengers.map((p) => (
                          <Badge key={p.bookingId} tone="neutral">{p.bookingRef} · {p.people}</Badge>
                        ))}
                      </div>
                      <Button
                        variant="secondary"
                        loading={claim.isPending}
                        onClick={() =>
                          claim.mutate(trip._id, {
                            onSuccess: () => { setOpenId(trip._id); toast('success', t('trips.claimed', { ref: trip.ref })) },
                            onError: fail,
                          })
                        }
                        data-testid={`captain-claim-${trip._id}`}
                      >
                        <Anchor size={15} /> {t('trips.claim')}
                      </Button>
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
