import { useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { Banknote, Receipt, Activity, TriangleAlert, Boxes, Users, Scale, Clock } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle, StatCard, Spinner, Badge, EmptyState } from '@/components/ui'
import { BarChart, DonutChart } from '@/components/Charts'
import { Timer } from '@/components/Timer'
import { useManagerOverview, useManagerLiveSessions } from '@/hooks'
import { engineLabel } from '@/config/engineMeta'
import { CHART_COLORS } from '@/config/chartColors'
import { formatDayLabel, money } from '@/utils'
import type { EngineKind } from '@/api/types'

export function ManagerOverview() {
  const { t } = useTranslation(['manager', 'common'])
  const navigate = useNavigate()
  const { data, isLoading } = useManagerOverview()
  const { data: live = [] } = useManagerLiveSessions()

  if (isLoading || !data) {
    return (
      <div data-testid="manager-overview">
        <PageHeader title={t('overview.title')} subtitle={t('overview.loading')} />
        <Spinner />
      </div>
    )
  }

  const overtimeNow = live.filter((s) => s.isOvertime)
  const penaltyAccruing = overtimeNow.reduce((sum, s) => sum + s.penaltyAmount, 0)

  return (
    <div data-testid="manager-overview">
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.overview') }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label={t('overview.revenueToday')} value={money(data.revenue.today)} icon={<Banknote size={22} />} tone="success" testId="mgr-revenue-today" />
        <StatCard label={t('overview.last7')} value={money(data.revenue.last7Days)} icon={<Banknote size={22} />} tone="info" sublabel={t('overview.rolling')} />
        <StatCard label={t('overview.last30')} value={money(data.revenue.last30Days)} icon={<Banknote size={22} />} tone="info" sublabel={t('overview.rolling')} />
        <StatCard label={t('overview.transactionsToday')} value={data.transactionsToday} icon={<Receipt size={22} />} testId="mgr-tx-today" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label={t('overview.activeSessions')} value={data.activeSessions} icon={<Activity size={22} />} tone="info" testId="mgr-active" />
        <StatCard
          label={t('overview.overdue')}
          value={data.overdueSessions}
          icon={<Clock size={22} />}
          tone={data.overdueSessions ? 'danger' : 'neutral'}
          sublabel={penaltyAccruing > 0 ? t('overview.accruing', { amount: money(penaltyAccruing) }) : t('overview.noneAccruing')}
          testId="mgr-overdue"
        />
        <StatCard
          label={t('overview.openIncidents')}
          value={data.openIncidents}
          icon={<TriangleAlert size={22} />}
          tone={data.openIncidents ? 'warning' : 'neutral'}
          onClick={() => navigate('/manager/incidents')}
          testId="mgr-incidents"
        />
        <StatCard
          label={t('overview.cashVariances')}
          value={data.pendingVariances}
          icon={<Scale size={22} />}
          tone={data.pendingVariances ? 'warning' : 'neutral'}
          sublabel={t('overview.awaitingApproval')}
          onClick={() => navigate('/manager/shifts')}
          testId="mgr-variances"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-3">{t('overview.revenue14')}</SectionTitle>
          <BarChart
            data={data.revenueTrend.map((d) => ({
              label: formatDayLabel(d.date).replace(' ', '\n'),
              value: Math.round(d.total),
            }))}
            height={180}
          />
        </Card>

        <Card>
          <SectionTitle className="mb-3 flex items-center gap-2"><Boxes size={18} />{t('overview.utilisation')}</SectionTitle>
          <DonutChart
            data={[
              { label: t('common:label.inuse'), value: data.estate.inUse, color: CHART_COLORS[0] },
              { label: t('common:label.available'), value: data.estate.available, color: CHART_COLORS[1] },
              { label: t('common:label.outofservice'), value: data.estate.outOfService, color: CHART_COLORS[2] },
            ]}
          />
          <p className="mt-3 text-sm text-muted">
            <Trans
              i18nKey="manager:overview.utilisationLine"
              values={{ pct: data.estate.utilisationPct, units: t('overview.unitsInUse', { count: data.estate.totalUnits }) }}
              components={{ 1: <strong className="text-navy dark:text-dk-texthi" /> }}
            />
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <Card>
          <SectionTitle className="mb-3">{t('overview.revenueByService')}</SectionTitle>
          {data.byEngine.every((e) => e.revenue === 0) ? (
            <EmptyState title={t('overview.noRevenue')} message={t('overview.noRevenueMessage')} />
          ) : (
            <div className="flex flex-col gap-2" data-testid="mgr-by-engine">
              {data.byEngine.map((e) => {
                const max = Math.max(...data.byEngine.map((x) => x.revenue), 1)
                return (
                  <div key={e.engineKind}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-navy dark:text-dk-text">{engineLabel(e.engineKind as EngineKind)}</span>
                      <span className="font-semibold tabular-nums">{money(e.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-canvas dark:bg-dk-elevated overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(e.revenue / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle className="mb-3">{t('overview.stations30')}</SectionTitle>
          {data.byStation.length === 0 ? (
            <EmptyState title={t('overview.noActivity')} message={t('overview.noActivityMessage')} />
          ) : (
            <ul className="flex flex-col gap-2" data-testid="mgr-by-station">
              {data.byStation.map((s) => (
                <li key={s.stationId} className="flex items-center justify-between rounded-lg bg-canvas dark:bg-dk-elevated px-3 py-2">
                  <span className="text-sm text-navy dark:text-dk-text">{s.name}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <Badge tone="info">{t('overview.liveCount', { count: s.active })}</Badge>
                    <span className="text-muted tabular-nums">{t('overview.bookingsCount', { count: s.bookings })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Users size={15} /> {t('overview.staffAccounts', { count: data.staffCount })}
          </div>
        </Card>
      </div>

      {overtimeNow.length > 0 && (
        <Card className="mt-5 border-danger-strong/40">
          <SectionTitle className="mb-3 flex items-center gap-2 text-danger-strong">
            <Clock size={18} /> {t('overview.overtimeNow', { count: overtimeNow.length })}
          </SectionTitle>
          <ul className="flex flex-col gap-2" data-testid="mgr-overtime-list">
            {overtimeNow.slice(0, 8).map((s) => (
              <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                <span className="text-sm">
                  <span className="font-mono font-semibold">{s.ref}</span>
                  <span className="text-muted"> · {s.customerName} · {s.stationName}</span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <Timer expectedEndAt={s.expectedEndAt} />
                  <strong className="text-danger-strong tabular-nums">{money(s.penaltyAmount)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
