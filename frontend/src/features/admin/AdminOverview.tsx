import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, Banknote, Building2, Grid3x3, MapPin, TriangleAlert, Truck, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Icon } from '@/components/Icon'
import { useTenantOverview } from '@/hooks'
import { ENGINE_META, engineLabel } from '@/config/engineMeta'
import type { EngineKind, Role } from '@/api/types'
import type { TenantOverview } from '@/api/admin.api'

const ROLE_LABEL: Record<Role, string> = {
  TENANT_ADMIN: 'CEO / tenant admin',
  PROJECT_MANAGER: 'Project manager',
  MANAGER: 'Activity manager',
  SUPERVISOR: 'Supervisor',
  ACCOUNTANT: 'Accountant',
  HR: 'HR & expenses',
  AGENT: 'Kiosk agent',
  CHIEF_CAPTAIN: 'Chief captain',
  DELIVERY_AGENT: 'Delivery agent',
}

type SiteRow = TenantOverview['sites'][number]

export function AdminOverview() {
  const { t } = useTranslation(['admin', 'common'])
  const navigate = useNavigate()
  const { data, isLoading } = useTenantOverview()

  if (isLoading || !data) {
    return (
      <div data-testid="admin-overview">
        <PageHeader title={t('overview.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const money = (n: number) => `${n.toFixed(2)} ${data.tenant.currency}`
  const e = data.estate
  const o = data.operations

  return (
    <div data-testid="admin-overview">
      <PageHeader
        title={data.tenant.name}
        subtitle={t('overview.subtitle', { tenant: data.tenant.legalName })}
        crumbs={[{ label: t('common:crumb.tenantadmin') }, { label: t('common:crumb.overview') }]}
        helpId="admin-overview"
        actions={
          <Button variant="secondary" onClick={() => navigate('/admin/company')} data-testid="admin-go-company">
            <Building2 size={16} />{t('overview.companyBranding')}</Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('overview.estate')}
          value={`${e.sites} / ${e.stations} / ${e.kiosks}`}
          icon={<MapPin size={18} />}
          tone="info"
          sublabel={t('overview.sitesStationsKiosks')}
          onClick={() => navigate('/manager/organisation')}
          testId="admin-stat-estate"
        />
        <StatCard
          label={t('overview.assetsInUse')}
          value={`${e.inUse}/${e.units}`}
          icon={<Grid3x3 size={18} />}
          tone={e.utilisationPct > 85 ? 'warning' : 'info'}
          sublabel={t('overview.utilisation', { pct: e.utilisationPct, down: e.outOfService })}
          onClick={() => navigate('/assets')}
          testId="admin-stat-assets"
        />
        <StatCard
          label={t('overview.employees')}
          value={data.people.total}
          icon={<Users size={18} />}
          tone="neutral"
          sublabel={t('overview.activeCount', { count: data.people.active })}
          onClick={() => navigate('/manager/team')}
          testId="admin-stat-people"
        />
        <StatCard
          label={t('overview.revenue30')}
          value={money(data.money.last30Days)}
          icon={<Banknote size={18} />}
          tone="success"
          sublabel={t('overview.todayAmount', { amount: money(data.money.today) })}
          onClick={() => navigate('/manager/reports')}
          testId="admin-stat-revenue"
        />
      </div>

      {(o.overdue > 0 || o.openIncidents > 0 || o.reconciling > 0) && (
        <Card className="mb-6 p-4 border-amber-300 bg-amber-50 dark:bg-amber-900/20" data-testid="admin-attention">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {o.overdue > 0 && (
                <button className="text-navy dark:text-dk-text hover:underline" onClick={() => navigate('/manager/live')}>
                  {t('overview.runningLate', { count: o.overdue })}
                </button>
              )}
              {o.openIncidents > 0 && (
                <button className="text-navy dark:text-dk-text hover:underline" onClick={() => navigate('/manager/incidents')}>
                  <strong>{o.openIncidents}</strong> open incident{o.openIncidents === 1 ? '' : 's'}
                </button>
              )}
              {o.reconciling > 0 && (
                <button className="text-navy dark:text-dk-text hover:underline" onClick={() => navigate('/manager/shifts')}>
                  <strong>{o.reconciling}</strong> till{o.reconciling === 1 ? '' : 's'} awaiting sign-off
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start mb-6">
        <Card className="p-4" data-testid="admin-people-breakdown">
          <SectionTitle className="mb-3 flex items-center gap-2">
            <Users size={16} />{t('overview.whoWorksHere')}</SectionTitle>
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <div key={role} className="flex items-center justify-between py-1.5 border-b border-line dark:border-dk-border last:border-0">
              <span className="text-sm text-navy dark:text-dk-text">{t(`common:role.${role}`, { defaultValue: ROLE_LABEL[role] })}</span>
              <span className="tabular-nums font-semibold">{data.people.byRole[role] ?? 0}</span>
            </div>
          ))}
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/manager/team')} data-testid="admin-go-people">{t('overview.everyEmployee')}</Button>
        </Card>

        <Card className="p-4" data-testid="admin-operations">
          <SectionTitle className="mb-3 flex items-center gap-2">
            <Activity size={16} />{t('overview.rightNow')}</SectionTitle>
          {[
            { label: t('overview.live'), value: o.live },
            { label: t('overview.overdue'), value: o.overdue },
            { label: t('overview.bookings30d'), value: o.bookings30d },
            { label: t('overview.customers'), value: o.customers },
            { label: t('overview.openTills'), value: o.openTills },
            { label: t('overview.deliveriesOpen'), value: o.deliveriesOpen },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-line dark:border-dk-border last:border-0">
              <span className="text-sm text-navy dark:text-dk-text">{row.label}</span>
              <span className="tabular-nums font-semibold">{row.value}</span>
            </div>
          ))}
        </Card>

        <Card className="p-4" data-testid="admin-money">
          <SectionTitle className="mb-3 flex items-center gap-2">
            <Banknote size={16} />{t('overview.money30')}</SectionTitle>
          {[
            { label: t('overview.taken'), value: money(data.money.last30Days) },
            { label: t('common:label.cash'), value: money(data.money.cash30Days) },
            { label: t('common:label.card'), value: money(data.money.card30Days) },
            { label: t('overview.refunded'), value: money(data.money.refunded30Days) },
            { label: t('overview.expectedInTills'), value: money(data.money.expectedInTills) },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-line dark:border-dk-border last:border-0">
              <span className="text-sm text-navy dark:text-dk-text">{row.label}</span>
              <span className="tabular-nums font-semibold">{row.value}</span>
            </div>
          ))}
          <p className="text-[11px] text-muted mt-3">VAT {(data.tenant.vatRate * 100).toFixed(0)}% · {data.tenant.currency}</p>
        </Card>
      </div>

      <SectionTitle className="mb-2 flex items-center gap-2">
        <Truck size={16} />{t('overview.servicesYouRun')}</SectionTitle>
      <Card className="p-4 mb-6" data-testid="admin-engines">
        <div className="flex flex-wrap gap-2">
          {data.byEngine.map((row) => {
            const meta = ENGINE_META[row.engineKind as EngineKind]
            return (
              <div
                key={row.engineKind}
                className={clsx(
                  'lf-card p-3 flex-1 min-w-[190px]',
                  row.enabled ? 'border-brand/40' : 'opacity-60',
                )}
                data-testid={`admin-engine-${row.engineKind}`}
              >
                <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-2 text-sm">
                  {meta && <Icon name={meta.icon} size={16} className="text-brand" />}
                  {engineLabel(row.engineKind as EngineKind)}
                </p>
                <p className="text-xs text-muted mt-1">
                  {t('overview.unitsInUse', { units: row.units, inUse: row.inUse })}
                </p>
                <Badge tone={row.enabled ? 'success' : 'neutral'} className="mt-2">
                  {row.enabled ? t('common:state.enabled') : t('common:state.off')}
                </Badge>
              </div>
            )
          })}
        </div>
      </Card>

      <SectionTitle className="mb-2 flex items-center gap-2">
        <MapPin size={16} />{t('overview.sites')}</SectionTitle>
      <DataTable
        testId="admin-sites-table"
        rows={data.sites}
        keyOf={(r: SiteRow) => r._id}
        empty={{ title: t('overview.noSites'), message: t('overview.noSitesHint') }}
        columns={[
          {
            key: 'name',
            header: t('common:column.site'),
            sortValue: (r: SiteRow) => r.name,
            filter: { kind: 'text', value: (r: SiteRow) => `${r.name} ${r.city}` },
            render: (r: SiteRow) => (
              <div>
                <p className="font-semibold text-navy dark:text-dk-texthi">{r.name}</p>
                <p className="text-xs text-muted">{r.city} · {r.venueType}</p>
              </div>
            ),
          },
          { key: 'stations', header: t('common:column.stations'), align: 'right', sortValue: (r: SiteRow) => r.stations, render: (r: SiteRow) => <span className="tabular-nums">{r.stations}</span> },
          { key: 'kiosks', header: t('common:column.kiosks'), align: 'right', sortValue: (r: SiteRow) => r.kiosks, render: (r: SiteRow) => <span className="tabular-nums">{r.kiosks}</span> },
          {
            key: 'units',
            header: t('common:column.assets'),
            align: 'right',
            sortValue: (r: SiteRow) => r.units,
            render: (r: SiteRow) => <span className="tabular-nums">{r.inUse}/{r.units}</span>,
          },
          { key: 'staff', header: t('common:column.people'), align: 'right', sortValue: (r: SiteRow) => r.staff, render: (r: SiteRow) => <span className="tabular-nums">{r.staff}</span> },
          { key: 'live', header: t('common:column.live'), align: 'right', sortValue: (r: SiteRow) => r.live, render: (r: SiteRow) => <span className="tabular-nums">{r.live}</span> },
          {
            key: 'revenue',
            header: t('common:column.revenue30d'),
            align: 'right',
            sortValue: (r: SiteRow) => r.revenue30d,
            render: (r: SiteRow) => <strong className="tabular-nums">{money(r.revenue30d)}</strong>,
          },
          {
            key: 'status',
            header: t('common:column.status'),
            render: (r: SiteRow) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? t('common:state.active') : t('common:state.closed')}</Badge>,
          },
        ]}
      />
    </div>
  )
}
