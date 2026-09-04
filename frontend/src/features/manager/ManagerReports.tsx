import { useState } from 'react'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { useTranslation } from 'react-i18next'
import { Download, TrendingUp, Boxes, Package } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle, Button, Field, Spinner, StatCard, Badge } from '@/components/ui'
import { BarChart } from '@/components/Charts'
import { DataTable } from '@/components/DataTable'
import { useReportOccupancy, useReportRentals, useReportRevenue } from '@/hooks'
import { managerApi } from '@/api/manager.api'
import { useAuthStore } from '@/store/auth'
import { engineLabel } from '@/config/engineMeta'
import { formatDayLabel, money } from '@/utils'
import { toast } from '@/state/toastStore'
import type { EngineKind } from '@/api/types'

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

export function ManagerReports() {
  const { t } = useTranslation(['manager', 'common'])
  const statusLabel = useStatusLabel()
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(today())
  const range = { from, to }

  const revenue = useReportRevenue(range)
  const occupancy = useReportOccupancy()
  const rentals = useReportRentals(range)
  const token = useAuthStore((s) => s.token)

  const exportCsv = async (kind: string) => {
    try {
      const res = await fetch(managerApi.exportUrl(kind, range), { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${kind}-${from}-to-${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('success', t('reports.exported'), `${kind}.csv`)
    } catch (e) {
      toast('danger', t('reports.couldNotExport'), e instanceof Error ? e.message : '')
    }
  }

  const loading = revenue.isLoading || occupancy.isLoading || rentals.isLoading

  return (
    <div data-testid="manager-reports">
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.reports') }]}
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <Field label={t('common:field.from')}><input type="date" className="lf-input" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="report-from" /></Field>
          <Field label="To"><input type="date" className="lf-input" value={to} onChange={(e) => setTo(e.target.value)} data-testid="report-to" /></Field>
          <div className="flex flex-wrap gap-2 pb-4">
            {[7, 30, 90].map((d) => (
              <Button key={d} variant="ghost" onClick={() => { setFrom(daysAgo(d - 1)); setTo(today()) }}>{t('reports.lastDays', { count: d })}</Button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? <Spinner /> : (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <SectionTitle className="flex items-center gap-2"><TrendingUp size={18} />{t('reports.revenue')}</SectionTitle>
              <Button variant="secondary" onClick={() => exportCsv('revenue')} data-testid="export-revenue"><Download size={15} /> CSV</Button>
            </div>
            {revenue.data && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <StatCard label={t('reports.gross')} value={money(revenue.data.gross)} tone="success" testId="report-gross" />
                  <StatCard label={t('reports.transactions')} value={revenue.data.transactions} />
                  <StatCard label={t('reports.overtimeRevenue')} value={money(revenue.data.overtimeRevenue)} tone="warning" />
                  <StatCard label={t('reports.avgPerDay')} value={money(revenue.data.daily.length ? revenue.data.gross / revenue.data.daily.length : 0)} />
                </div>
                <BarChart
                  data={revenue.data.daily.slice(-30).map((d) => ({
                    label: formatDayLabel(d.date),
                    value: Math.round(d.total),
                  }))}
                  height={170}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">{t('reports.byPaymentMethod')}</p>
                    {revenue.data.byMethod.map((m) => (
                      <div key={m.method} className="flex justify-between text-sm py-1 border-b border-line last:border-0">
                        <span><Badge tone="neutral">{statusLabel(m.method, 'method')}</Badge> <span className="text-muted">{t('reports.txnCount', { count: m.count })}</span></span>
                        <strong className="tabular-nums">{money(m.total)}</strong>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">{t('reports.byService')}</p>
                    {revenue.data.byEngine.filter((e) => e.total > 0).map((e) => (
                      <div key={e.engineKind} className="flex justify-between text-sm py-1 border-b border-line last:border-0">
                        <span>{engineLabel(e.engineKind as EngineKind)}</span>
                        <strong className="tabular-nums">{money(e.total)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <SectionTitle className="flex items-center gap-2"><Boxes size={18} />{t('reports.occupancy')}</SectionTitle>
              <Button variant="secondary" onClick={() => exportCsv('occupancy')} data-testid="export-occupancy"><Download size={15} /> CSV</Button>
            </div>
            {occupancy.data && (
              <DataTable
                testId="occupancy-table"
                rows={occupancy.data.byAssetType}
                keyOf={(r) => r.assetTypeId}
                initialSort={{ key: 'utilisation', dir: 'desc' }}
                pageSize={12}
                empty={{ title: t('reports.noOccupancy'), message: t('reports.noOccupancyHint') }}
                columns={[
                  {
                    key: 'name',
                    header: t('reports.assetType'),
                    sortValue: (r) => r.name,
                    filter: { kind: 'text', value: (r) => r.name },
                    render: (r) => <span className="font-medium">{r.name}</span>,
                  },
                  {
                    key: 'kind',
                    header: t('common:column.kind'),
                    sortValue: (r) => r.kind,
                    filter: {
                      kind: 'select',
                      options: [...new Set(occupancy.data.byAssetType.map((r) => r.kind))].map((k) => ({
                        label: t(`assets:kind.${k}`, { defaultValue: k }),
                        value: k,
                      })),
                      value: (r) => r.kind,
                    },
                    render: (r) => <span className="text-muted">{t(`assets:kind.${r.kind}`, { defaultValue: r.kind })}</span>,
                  },
                  { key: 'total', header: t('common:field.total'), align: 'right', sortValue: (r) => r.total, render: (r) => <span className="tabular-nums">{r.total}</span> },
                  { key: 'inUse', header: t('assets:table.inUse'), align: 'right', sortValue: (r) => r.inUse, render: (r) => <span className="tabular-nums">{r.inUse}</span> },
                  { key: 'down', header: t('assets:table.down'), align: 'right', sortValue: (r) => r.outOfService, render: (r) => <span className="tabular-nums">{r.outOfService}</span> },
                  {
                    key: 'utilisation',
                    header: t('assets:table.utilisation'),
                    align: 'right',
                    sortValue: (r) => r.utilisationPct,
                    render: (r) => (
                      <Badge tone={r.utilisationPct > 80 ? 'danger' : r.utilisationPct > 50 ? 'warning' : 'success'}>{r.utilisationPct}%</Badge>
                    ),
                  },
                ]}
              />
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <SectionTitle className="flex items-center gap-2"><Package size={18} /> {t('reports.rentals')}</SectionTitle>
              <Button variant="secondary" onClick={() => exportCsv('rentals')} data-testid="export-rentals"><Download size={15} /> CSV</Button>
            </div>
            {rentals.data && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label={t('common:field.total')} value={rentals.data.total} testId="report-rentals-total" />
                <StatCard label={t('reports.completed')} value={rentals.data.completed} tone="success" />
                <StatCard label={t('reports.overdueNow')} value={rentals.data.overdueNow} tone={rentals.data.overdueNow ? 'danger' : 'neutral'} sublabel={money(rentals.data.penaltyAccruing) + ' accruing'} />
                <StatCard label={t('reports.avgDuration')} value={`${Math.floor(rentals.data.averageDurationMin / 60)}h ${rentals.data.averageDurationMin % 60}m`} />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
