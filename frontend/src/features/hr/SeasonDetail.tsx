import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Receipt, UserCheck, UserX, Users, Wallet } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { useSeason } from '@/hooks'
import { categoryLabel, type Expense, type SeasonEmployee } from '@/api/hr.api'
import { engineLabel } from '@/config/engineMeta'
import { PayrollDialog } from './PayrollDialog'
import { ROLE_LABELS } from './roles'

const money = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`
const day = (d: string) => new Date(d).toISOString().slice(0, 10)

export function SeasonDetail() {
  const { t } = useTranslation(['hr', 'common'])
  const { id = '' } = useParams()
  const { data: season, isLoading } = useSeason(id)
  const [charging, setCharging] = useState(false)

  if (isLoading || !season) {
    return (
      <div data-testid="season-detail">
        <PageHeader title={t('season.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const charged = season.employees.filter((e) => e.charged)
  const missing = season.employees.filter((e) => e.active && !e.charged)

  return (
    <div data-testid="season-detail">
      <PageHeader
        title={season.name}
        subtitle={`${day(season.startsAt)} → ${day(season.endsAt)} · ${t('season.months', { count: season.months })}`}
        crumbs={[{ label: t('common:crumb.hr') }, { label: t('common:crumb.seasons'), to: '/hr/seasons' }, { label: season.name }]}
        helpId="hr-seasons"
        actions={
          <>
            <Button onClick={() => setCharging(true)} disabled={!missing.length} data-testid="season-charge">
              <Users size={16} /> {missing.length ? t('season.chargeEmployees', { count: missing.length }) : t('season.everyoneCharged')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard
          label={t('season.costBase')}
          value={money(season.expenseBase)}
          icon={<Wallet size={18} />}
          tone="info"
          sublabel={t('season.entriesWithVat', { count: season.expenseCount, vat: money(season.expenseVat) })}
          testId="season-stat-base"
        />
        <StatCard
          label={t('season.adminCharges')}
          value={money(season.payrollBase)}
          icon={<Users size={18} />}
          tone="neutral"
          sublabel={t('season.employeeCost')}
          testId="season-stat-payroll"
        />
        <StatCard
          label={t('season.employeesCharged')}
          value={`${charged.length} of ${season.chargeable}`}
          icon={<UserCheck size={18} />}
          tone={missing.length ? 'warning' : 'success'}
          sublabel={missing.length ? t('season.stillToCharge', { count: missing.length }) : t('season.allOnSeason')}
          testId="season-stat-employees"
        />
        <StatCard
          label={t('season.operatingCosts')}
          value={money(season.expenseBase - season.payrollBase)}
          icon={<Receipt size={18} />}
          tone="neutral"
          sublabel={t('costs.entryCount', { count: season.costs.length })}
          testId="season-stat-costs"
        />
      </div>

      {missing.length > 0 && (
        <Card className="p-4 mb-5 border-s-4 border-s-amber-400" data-testid="season-warning">
          <p className="font-semibold text-navy dark:text-dk-texthi text-sm">
            {t('season.uncharged', { count: missing.length })}
          </p>
          <p className="text-sm text-muted mt-1">
            {t('season.unchargedWhy', { names: missing.map((m) => m.fullName).join(', ') })}
          </p>
        </Card>
      )}

      <SectionTitle className="mb-2 flex items-center gap-2">
        <Users size={16} />{t('season.employeesOn')}</SectionTitle>
      <DataTable
        testId="season-employees-table"
        rows={season.employees}
        keyOf={(e: SeasonEmployee) => e.userId}
        pageSize={10}
        empty={{ title: t('season.nobodyToCharge'), message: t('season.nobodyToChargeHint') }}
        columns={[
          {
            key: 'name',
            header: t('common:column.employee'),
            sortValue: (e: SeasonEmployee) => e.fullName,
            filter: { kind: 'text', value: (e: SeasonEmployee) => e.fullName },
            render: (e: SeasonEmployee) => (
              <div className="flex items-center gap-2">
                {e.charged ? (
                  <UserCheck size={15} className="text-success shrink-0" />
                ) : (
                  <UserX size={15} className="text-amber-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold text-navy dark:text-dk-texthi">{e.fullName}</p>
                  {!e.active && <p className="text-[11px] text-muted">{t('common:state.suspended')}</p>}
                </div>
              </div>
            ),
          },
          {
            key: 'role',
            header: t('common:column.role'),
            filter: {
              kind: 'select',
              options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ label, value })),
              value: (e: SeasonEmployee) => e.role,
            },
            render: (e: SeasonEmployee) => <Badge tone="neutral">{t(`common:role.${e.role.toUpperCase()}`, { defaultValue: e.role })}</Badge>,
          },
          {
            key: 'monthly',
            header: t('common:column.monthly'),
            align: 'right',
            sortValue: (e: SeasonEmployee) => e.monthly,
            render: (e: SeasonEmployee) =>
              e.charged ? <span className="tabular-nums">{e.monthly.toFixed(2)}</span> : <span className="text-muted">—</span>,
          },
          {
            key: 'months',
            header: t('common:column.months'),
            align: 'right',
            render: () => <span className="tabular-nums text-muted">{season.months}</span>,
          },
          {
            key: 'total',
            header: t('common:column.charged'),
            align: 'right',
            sortValue: (e: SeasonEmployee) => e.amount,
            render: (e: SeasonEmployee) =>
              e.charged ? (
                <strong className="tabular-nums">{e.amount.toFixed(2)}</strong>
              ) : (
                <Badge tone="warning">{t('season.notCharged')}</Badge>
              ),
          },
        ]}
      />

      <SectionTitle className="mb-2 mt-6 flex items-center gap-2">
        <Receipt size={16} />{t('season.costsBooked')}</SectionTitle>
      <DataTable
        testId="season-costs-table"
        rows={season.costs}
        keyOf={(c: Expense) => c._id}
        pageSize={10}
        initialSort={{ key: 'when', dir: 'desc' }}
        empty={{ title: t('season.noCosts'), message: t('season.noCostsHint') }}
        columns={[
          {
            key: 'what',
            header: t('common:column.cost'),
            sortValue: (c: Expense) => c.description,
            filter: { kind: 'text', value: (c: Expense) => `${c.description} ${c.supplier} ${c.reference}` },
            render: (c: Expense) => (
              <div className="max-w-[300px]">
                <p className="text-sm font-semibold text-navy dark:text-dk-texthi truncate">{c.description}</p>
                <p className="text-[11px] text-muted">{c.supplier || '—'} · {c.reference || t('common:label.noReference')}</p>
              </div>
            ),
          },
          {
            key: 'category',
            header: t('common:column.category'),
            filter: {
              kind: 'select',
              options: season.byCategory.map((c) => ({ label: categoryLabel(c.category), value: c.category })),
              value: (c: Expense) => c.category,
            },
            render: (c: Expense) => <Badge tone="neutral">{categoryLabel(c.category)}</Badge>,
          },
          {
            key: 'activity',
            header: t('common:column.activity'),
            render: (c: Expense) =>
              c.engineKind ? (engineLabel(c.engineKind)) : <span className="text-muted">—</span>,
          },
          {
            key: 'base',
            header: t('common:column.exvat'),
            align: 'right',
            sortValue: (c: Expense) => c.baseAmount,
            render: (c: Expense) => <span className="tabular-nums">{c.baseAmount.toFixed(2)}</span>,
          },
          {
            key: 'total',
            header: t('common:column.total'),
            align: 'right',
            sortValue: (c: Expense) => c.amount,
            render: (c: Expense) => <strong className="tabular-nums">{c.amount.toFixed(2)}</strong>,
          },
          {
            key: 'when',
            header: t('common:column.incurred'),
            align: 'right',
            sortValue: (c: Expense) => c.incurredAt,
            render: (c: Expense) => <span className="text-xs text-muted">{day(c.incurredAt)}</span>,
          },
        ]}
      />

      {season.byCategory.length > 0 && (
        <>
          <SectionTitle className="mb-2 mt-6">{t('season.whereMoneyWent')}</SectionTitle>
          <Card className="p-4" data-testid="season-by-category">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-1">
              {season.byCategory.map((c) => (
                <div key={c.category} className="flex items-baseline justify-between gap-3 py-1 border-b border-line/60 dark:border-dk-border/60">
                  <span className="text-sm text-muted truncate">{categoryLabel(c.category)}</span>
                  <span className={clsx('tabular-nums text-sm font-semibold shrink-0', c.category === 'PAYROLL' && 'text-brand')}>
                    {c.base.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <PayrollDialog
        open={charging}
        onClose={() => setCharging(false)}
        seasonId={season._id}
        seasonName={season.name}
        months={season.months}
        employees={season.employees}
      />
    </div>
  )
}
