import i18n from '@/i18n'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, AlertTriangle, Anchor, ArrowRight, Boxes, CirclePlus, Clock, PackageCheck, Receipt, TriangleAlert, Wallet, Timer as TimerIcon, BarChart3, PieChart } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { RefLink } from '@/components/RefLink'
import { Card, StatCard, Button, StatusBadge, SectionTitle, Spinner } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Timer } from '@/components/Timer'
import { BarChart, DonutChart } from '@/components/Charts'
import { CHART_COLORS } from '@/config/chartColors'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/auth'
import { can } from '@/permissions/permissions'
import { useDashboard, useBookings, useShift } from '@/hooks'
import { ENGINE_META } from '@/config/engineMeta'
import { money, formatTime } from '@/utils'
import type { EngineKind } from '@/api/types'

const shortEngine = (kind: EngineKind): string => i18n.t(`common:engineShort.${kind}`, { defaultValue: kind })

export function DashboardPage() {
  const { t } = useTranslation('agent')
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.me)
  const sells = can(me?.role, 'pos.use')
  const sails = can(me?.role, 'trip.sail')
  const engines = me?.engineKinds ?? []

  const actions = [
    ...(sells && engines.includes('SHOP_AND_DROP')
      ? [{ icon: 'ShoppingBag', label: 'Shop & Drop', to: '/shop-drop', testId: 'qa-shopdrop' }]
      : []),
    ...(sells && engines.includes('MOBILITY')
      ? [{ icon: 'Bike', label: 'Mobility', to: '/mobility', testId: 'qa-mobility' }]
      : []),
    ...(sells && engines.includes('LAGOON')
      ? [{ icon: 'Sailboat', label: 'Lagoon', to: '/lagoon', testId: 'qa-lagoon' }]
      : []),
    ...(sails ? [{ icon: 'Map', label: t('voyage.title'), to: '/lagoon/voyage', testId: 'qa-voyage' }] : []),
    ...(can(me?.role, 'customer.manage')
      ? [{ icon: 'Users', label: t('common:crumb.customers'), to: '/customers', testId: 'qa-customers' }]
      : []),
    ...(can(me?.role, 'assets.view')
      ? [{ icon: 'Grid3x3', label: t('common:crumb.assets'), to: '/assets', testId: 'qa-assets' }]
      : []),
  ]
  const { data: stats, isLoading, isError } = useDashboard()
  const { data: bookings = [] } = useBookings()
  const { data: shift } = useShift()
  if (!me) return null

  const active = bookings
    .filter((b) => b.status === 'ACTIVE' || b.status === 'OVERTIME')
    .sort((a, b) => new Date(a.session.expectedEndAt ?? 0).getTime() - new Date(b.session.expectedEndAt ?? 0).getTime())
    .slice(0, 5)
  const recent = [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6)

  const engineBars = (stats?.byEngine ?? []).map((e) => ({ label: shortEngine(e.engineKind), value: e.count }))
  const engineDonut = (stats?.byEngine ?? []).filter((e) => e.count > 0).map((e, i) => ({ label: shortEngine(e.engineKind), value: e.count, color: CHART_COLORS[i % CHART_COLORS.length] }))

  return (
    <div data-testid="dashboard">
      <PageHeader helpId="dashboard"
        title={t('dashboard.greeting', { name: me.fullName.split(' ')[0] })}
        subtitle={`${me.tenant?.name} · ${me.station?.name}`}
        actions={
          <>
            {sells && (
              <Button variant="secondary" onClick={() => navigate('/shift')} data-testid="dash-shift">
                <Clock size={16} /> {t('dashboard.shift')} {shift ? <StatusBadge status={shift.status} group="shift" /> : t('dashboard.shiftClosed')}
              </Button>
            )}
            {sails && (
              <Button onClick={() => navigate('/lagoon/captain')} data-testid="dash-my-trips">
                <Anchor size={16} /> {t('dashboard.myTrips')}
              </Button>
            )}
            {sells && (
              <Button onClick={() => navigate('/pos')} data-testid="dash-new-transaction"><CirclePlus size={16} /> {t('dashboard.newTransaction')}</Button>
            )}
          </>
        }
      />

      {isLoading && !isError ? (
        <Spinner label={t('dashboard.loading')} />
      ) : !stats ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard label={t('dashboard.stat.todaysTransactions')} value={stats.todaysTransactions} icon={<Receipt size={22} />} tone="info" testId="stat-transactions" onClick={() => navigate('/bookings')} />
            <StatCard label={t('dashboard.stat.todaysRevenue')} value={money(stats.todaysRevenue)} icon={<Wallet size={22} />} tone="success" testId="stat-revenue" onClick={() => navigate('/bookings')} />
            <StatCard label={t('dashboard.stat.activeOperations')} value={stats.activeOperations} icon={<Activity size={22} />} tone="info" testId="stat-active" onClick={() => navigate('/operations')} />
            <StatCard label={t('dashboard.stat.bagsStored')} value={stats.storedBags} icon={<Boxes size={22} />} tone="neutral" testId="stat-bags" onClick={() => navigate('/operations')} />
            <StatCard label={t('dashboard.stat.dueSoon')} value={stats.dueSoon} icon={<TimerIcon size={22} />} tone="warning" sublabel={t('dashboard.stat.within45')} testId="stat-duesoon" onClick={() => navigate('/operations')} />
            <StatCard label={t('dashboard.stat.overdue')} value={stats.overdue} icon={<AlertTriangle size={22} />} tone="danger" testId="stat-overdue" onClick={() => navigate('/operations')} />
            <StatCard label={t('dashboard.stat.pendingRetrievals')} value={stats.pendingRetrievals} icon={<PackageCheck size={22} />} tone="warning" testId="stat-retrievals" onClick={() => navigate('/operations')} />
            <StatCard label={t('dashboard.stat.openIncidents')} value={stats.openIncidents} icon={<TriangleAlert size={22} />} tone="danger" testId="stat-incidents" onClick={() => navigate('/incidents')} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <Card>
              <SectionTitle className="mb-3 flex items-center gap-2"><BarChart3 size={18} /> {t('dashboard.bookingsByEngine')}</SectionTitle>
              <BarChart data={engineBars} />
            </Card>
            <Card>
              <SectionTitle className="mb-3 flex items-center gap-2"><PieChart size={18} /> {t('dashboard.engineMix')}</SectionTitle>
              {engineDonut.length ? <DonutChart data={engineDonut} /> : <p className="text-sm text-muted py-8 text-center">{t('dashboard.noBookings')}</p>}
            </Card>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>{t('dashboard.activeOperations')}</SectionTitle>
            <button className="text-sm text-brand font-medium flex items-center gap-1" onClick={() => navigate('/operations')}>{t('dashboard.viewAll')} <ArrowRight size={14} /></button>
          </div>
          {active.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">{t('dashboard.noActive')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {active.map((b) => (
                <button key={b.id} onClick={() => navigate(`/bookings/${b.id}`)} className="lf-card p-3 flex items-center gap-3 text-start lf-card-hover" data-testid={`active-${b.ref}`}>
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand shrink-0"><Icon name={ENGINE_META[b.engineKind].icon} size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-semibold text-sm text-navy dark:text-dk-texthi">{b.ref}</span><StatusBadge status={b.status} /></div>
                    <p className="text-xs text-muted truncate">{b.productName}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <Timer expectedEndAt={b.session.expectedEndAt} />
                    <p className="text-[11px] text-muted">{t('dashboard.endsAt', { time: formatTime(b.session.expectedEndAt ? new Date(b.session.expectedEndAt).getTime() : null) })}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          {actions.length > 0 && (
            <>
              <SectionTitle className="mb-3">{t('dashboard.quickActions')}</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((action) => (
                  <QuickAction
                    key={action.testId}
                    icon={action.icon}
                    label={action.label}
                    onClick={() => navigate(action.to)}
                    testId={action.testId}
                  />
                ))}
              </div>
            </>
          )}
          <SectionTitle className={clsx('mb-3', actions.length > 0 && 'mt-5')}>{t('dashboard.recent')}</SectionTitle>
          <div className="flex flex-col divide-y divide-line">
            {recent.map((b) => (
              <button key={b.id} onClick={() => navigate(`/bookings/${b.id}`)} className="flex items-center gap-2 py-2 text-start text-sm">
                <RefLink to={`/bookings/${b.id}`} className="w-16 shrink-0">{b.ref}</RefLink>
                <span className="flex-1 truncate">{b.productName}</span>
                <StatusBadge status={b.status} />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick, testId }: { icon: string; label: string; onClick: () => void; testId: string }) {
  return (
    <button onClick={onClick} data-testid={testId} className="flex flex-col items-center gap-2 p-3 rounded-xl2 border border-line hover:border-brand hover:bg-brand/5 transition-colors">
      <Icon name={icon} size={22} className="text-brand" />
      <span className="text-xs font-semibold text-navy dark:text-dk-text">{label}</span>
    </button>
  )
}
