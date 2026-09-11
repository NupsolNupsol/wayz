import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DoorOpen, PackageOpen } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, EmptyState, Spinner, StatCard, StatusBadge } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { RefLink } from '@/components/RefLink'
import { Timer } from '@/components/Timer'
import { useBookings } from '@/hooks'
import { useAuthStore } from '@/store/auth'
import { formatDateTime, money } from '@/utils'
import type { Booking } from '@/api/types'

/**
 * The locker hall this agent answers for.
 *
 * A Shop & Drop counter sells storage and holds none of it — the lockers are here, at the gate,
 * and the bags were carried over by a courier. So the customer coming back for them walks to this
 * hall, not to the counter that served them, and the person standing here is the one who checks
 * them and opens the locker.
 *
 * That is the whole reason this page exists. Everything a Mobility agent already does at their
 * vehicle bay is untouched; this is the second half of their job, and without it the bags sitting
 * behind them would belong to nobody on screen.
 */
export function MyGatePage() {
  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const gate = useAuthStore((s) => s.me?.gate ?? null)
  const { data: bookings = [], isLoading } = useBookings()

  /*
   * The bags in this hall, and only those.
   *
   * The list a desk-scoped agent is given already carries both halves of their work — the rentals
   * they sold at the bay, and the bags standing in their gate — so this narrows it to the second.
   */
  const here = useMemo(
    () => bookings.filter((b) => !!gate && b.gateId === gate.id && b.engineKind === 'SHOP_AND_DROP'),
    [bookings, gate],
  )

  const waiting = here.filter((b) => ['ACTIVE', 'OVERTIME'].includes(b.status))
  const goingOut = here.filter((b) => b.status === 'RETRIEVAL_IN_PROGRESS')
  const owed = here.reduce((sum, b) => sum + (b.amountDue ?? 0), 0)

  if (!gate) {
    return (
      <div data-testid="my-gate-page">
        <PageHeader title={t('gate.title')} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }]} />
        <EmptyState
          title={t('gate.noneTitle')}
          message={t('gate.noneBlurb')}
          icon={<DoorOpen size={28} />}
        />
      </div>
    )
  }

  if (isLoading) return <Spinner />

  return (
    <div data-testid="my-gate-page">
      <PageHeader
        title={gate.name}
        subtitle={gate.location || t('gate.subtitle')}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('gate.title') }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard
          label={t('gate.stat.inLockers')}
          value={waiting.length}
          icon={<PackageOpen size={22} />}
          tone="info"
          testId="gate-stat-waiting"
        />
        <StatCard
          label={t('gate.stat.comingOut')}
          value={goingOut.length}
          icon={<DoorOpen size={22} />}
          tone="warning"
          testId="gate-stat-out"
        />
        <StatCard
          label={t('gate.stat.owed')}
          value={money(owed)}
          icon={<PackageOpen size={22} />}
          tone={owed > 0 ? 'warning' : 'neutral'}
          testId="gate-stat-owed"
        />
      </div>

      <Card>
        <DataTable<Booking>
          testId="gate-bookings"
          rows={here}
          keyOf={(b) => b.id}
          onRowClick={(b) => navigate(`/bookings/${b.id}`)}
          empty={{ title: t('gate.emptyTitle'), message: t('gate.emptyBlurb') }}
          search={{
            of: (b) => `${b.ref} ${b.customerName} ${b.customerPhone ?? ''}`,
            placeholder: t('gate.find'),
          }}
          columns={[
            {
              key: 'ref',
              header: t('common:column.reference'),
              sortValue: (b) => b.ref,
              render: (b) => <RefLink to={`/bookings/${b.id}`}>{b.ref}</RefLink>,
            },
            {
              key: 'customer',
              header: t('common:column.customer'),
              sortValue: (b) => b.customerName,
              filter: { kind: 'text', value: (b) => b.customerName },
              render: (b) => (
                <div className="min-w-0">
                  <p className="font-semibold text-navy dark:text-dk-texthi truncate">{b.customerName}</p>
                  <p className="text-xs text-muted">{b.customerPhone}</p>
                </div>
              ),
            },
            {
              key: 'bags',
              header: t('gate.column.bags'),
              align: 'right',
              sortValue: (b) => b.bags?.length ?? 0,
              render: (b) => <span className="tabular-nums">{b.bags?.length ?? 0}</span>,
            },
            {
              key: 'status',
              header: t('common:column.status'),
              filter: { kind: 'select', options: [...new Set(here.map((b) => b.status))].map((s) => ({ label: s, value: s })), value: (b) => b.status },
              render: (b) => <StatusBadge status={b.status} />,
            },
            {
              // The clock the customer is watching, and the one that decides whether anything is
              // owed before their bags come back out.
              key: 'remaining',
              header: t('common:column.remaining'),
              align: 'right',
              sortValue: (b) => new Date(b.session?.expectedEndAt ?? 0).getTime(),
              render: (b) =>
                b.session?.startedAt ? (
                  <Timer
                    expectedEndAt={b.session.expectedEndAt}
                    endedAt={b.session.endedAt ?? b.session.chargeableEndedAt}
                    gracePeriodMin={b.session.gracePeriodMin}
                  />
                ) : (
                  <span className="text-xs text-muted">{t('gate.notStored')}</span>
                ),
            },
            {
              key: 'due',
              header: t('common:column.due'),
              align: 'right',
              sortValue: (b) => b.amountDue ?? 0,
              render: (b) =>
                (b.amountDue ?? 0) > 0 ? (
                  <span className="font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                    {money(b.amountDue ?? 0)}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'stored',
              header: t('gate.column.since'),
              align: 'right',
              sortValue: (b) => new Date(b.session?.startedAt ?? 0).getTime(),
              render: (b) => (
                <span className="text-muted text-xs">
                  {formatDateTime(b.session?.startedAt ? new Date(b.session.startedAt).getTime() : null)}
                </span>
              ),
            },
          ]}
        />
      </Card>

      <p className="text-xs text-muted mt-3">{t('gate.openOneBlurb')}</p>
    </div>
  )
}
