import { useState } from 'react'
import { bilingual } from './bilingual'
import { useTranslation } from 'react-i18next'
import { Calculator, Download, FileSpreadsheet, Landmark, Receipt, TrendingDown, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Button, Card, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { Icon } from '@/components/Icon'
import { useAccountingLedger, useAccountingSummary, useVatReturn, useZakatReturn } from '@/hooks'
import { accountingApi } from '@/api/accounting.api'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { ENGINE_META } from '@/config/engineMeta'
import type { EngineKind } from '@/api/types'
import type { ActivityFigures, LedgerRow } from '@/api/accounting.api'

const REPORTED_ACTIVITIES: EngineKind[] = ['LAGOON', 'MOBILITY', 'SHOP_AND_DROP']

const iso = (d: Date) => d.toISOString().slice(0, 10)

function quarterRange(year: number, index: number): { from: string; to: string; label: string } {
  return {
    from: iso(new Date(Date.UTC(year, index * 3, 1))),
    to: iso(new Date(Date.UTC(year, index * 3 + 3, 0))),
    label: `Q${index + 1} ${year}`,
  }
}

function quartersOfYear(year: number) {
  return [0, 1, 2, 3].map((index) => quarterRange(year, index))
}

function yearRange(): { from: string; to: string } {
  const year = new Date().getFullYear()
  return { from: iso(new Date(Date.UTC(year, 0, 1))), to: iso(new Date(Date.UTC(year, 11, 31))) }
}

function daysBack(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return { from: iso(from), to: iso(to) }
}

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const currency = (n: number) => `${money(n)} SAR`

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function AccountingDashboard() {
  const { t } = useTranslation(['accounting', 'common'])
  const now = new Date()
  const year = now.getFullYear()
  const currentQuarter = Math.floor(now.getMonth() / 3)

  const [from, setFrom] = useState(daysBack(30).from)
  const [to, setTo] = useState(iso(new Date()))
  const [engineKind, setEngineKind] = useState<'' | EngineKind>('')
  const [busy, setBusy] = useState('')

  const filter = { from, to, ...(engineKind ? { engineKind } : {}) }
  const { data: summary, isLoading } = useAccountingSummary(filter)
  const { data: vat } = useVatReturn(filter)
  const { data: zakat } = useZakatReturn({ from, to })
  const { data: rows = [] } = useAccountingLedger(filter)

  const setRange = (range: { from: string; to: string }) => {
    setFrom(range.from)
    setTo(range.to)
  }
  const isRange = (range: { from: string; to: string }) => from === range.from && to === range.to

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key)
    try {
      await task()
    } catch (e) {
      toast('danger', t('dashboard.exportFailed'), e instanceof ApiError ? e.message : '')
    } finally {
      setBusy('')
    }
  }

  const downloadCsv = () =>
    run('csv', async () => {
      saveBlob(await accountingApi.download(filter), `wayz-vat-${from}_${to}.csv`)
      toast('success', t('dashboard.exportReady'), t('dashboard.csvNote'))
    })

  const downloadActivity = (kind: EngineKind) =>
    run(kind, async () => {
      saveBlob(
        await accountingApi.downloadActivityWorkbook(kind, { from, to }),
        `wayz-${kind.toLowerCase()}-${from}_${to}.xlsx`,
      )
      toast('success', `${t(`common:engine.${kind}`)} workbook ready`, 'Every transaction for that activity, with its own totals.')
    })

  const downloadAll = () =>
    run('all', async () => {
      saveBlob(await accountingApi.downloadFullWorkbook({ from, to }), `wayz-all-activities-${from}_${to}.xlsx`)
      toast('success', t('dashboard.workbookReady'), t('dashboard.workbookNote'))
    })

  if (isLoading || !summary) {
    return (
      <div data-testid="accounting-dashboard">
        <PageHeader title={t('dashboard.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const active = summary.activities.filter((a) => a.salesTotal > 0 || a.returnsTotal > 0)
  const topSales = Math.max(1, ...active.map((a) => a.salesBase))

  const presets: { label: string; range: { from: string; to: string }; current?: boolean }[] = [
    ...quartersOfYear(year).map((q, i) => ({ label: q.label, range: q, current: i === currentQuarter })),
    { label: t('dashboard.thisYear'), range: yearRange() },
    { label: t('dashboard.last30'), range: daysBack(30) },
  ]

  return (
    <div data-testid="accounting-dashboard">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        crumbs={[{ label: t('common:crumb.accounting') }, { label: t('common:crumb.reporting') }]}
        helpId="accounting-dashboard"
        actions={
          <Button variant="secondary" onClick={downloadCsv} loading={busy === 'csv'} data-testid="accounting-export">
            <Download size={16} /> {t('common:action.exportCsv')}
          </Button>
        }
      />

      <Card className="p-3 mb-4" data-testid="accounting-toolbar">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="acct-from">{t('dashboard.period')}</label>
            <input
              id="acct-from"
              type="date"
              className="lf-input w-[150px]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="accounting-from"
            />
            <span className="text-muted">→</span>
            <input
              type="date"
              className="lf-input w-[150px]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="accounting-to"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5" data-testid="accounting-presets">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setRange(p.range)}
                data-testid={`accounting-preset-${p.label.replace(/\s+/g, '-').toLowerCase()}`}
                title={p.current ? 'The quarter in progress' : undefined}
                className={clsx(
                  'px-2.5 h-8 rounded-lg text-xs font-semibold border transition-colors',
                  isRange(p.range)
                    ? 'bg-brand text-brand-fg border-brand'
                    : p.current
                      ? 'border-brand bg-brand/10 text-brand hover:bg-brand/20'
                      : 'border-line dark:border-dk-border text-muted hover:text-brand hover:border-brand',
                )}
              >
                {p.label}
                {p.current && <span className="ms-1.5 opacity-70">{t('period.now')}</span>}
              </button>
            ))}
          </div>

          <div className="ms-auto w-[200px]">
            <Select
              value={engineKind}
              onChange={(v) => setEngineKind(v as '' | EngineKind)}
              options={[
                { label: t('dashboard.allActivitiesFilter'), value: '' },
                ...REPORTED_ACTIVITIES.map((k) => ({ label: t(`common:engine.${k}`), value: k })),
              ]}
              testId="accounting-activity"
            />
          </div>
        </div>
      </Card>

      {vat && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <StatCard
              label={t('dashboard.salesExVat')}
              value={currency(vat.salesBase)}
              icon={<TrendingUp size={18} />}
              tone="success"
              sublabel={t('dashboard.vatCollected', { amount: money(vat.salesVat) })}
              testId="acct-stat-sales"
            />
            <StatCard
              label={t('dashboard.returnsExVat')}
              value={currency(vat.returnsBase)}
              icon={<TrendingDown size={18} />}
              tone={vat.returnsBase > 0 ? 'warning' : 'neutral'}
              sublabel={t('dashboard.vatReturned', { amount: money(vat.returnsVat) })}
              testId="acct-stat-returns"
            />
            <StatCard
              label={t('dashboard.purchases')}
              value={currency(vat.purchasesBase)}
              icon={<Receipt size={18} />}
              tone="neutral"
              sublabel={t('dashboard.vatPaid', { amount: money(vat.purchasesVat) })}
              testId="acct-stat-purchases"
            />
            <StatCard
              label={vat.refundable ? t('dashboard.vatRefundable') : t('dashboard.vatDue')}
              value={currency(Math.abs(vat.dueVat))}
              icon={<Calculator size={18} />}
              tone={vat.refundable ? 'info' : 'danger'}
              sublabel={`${(vat.vatRate * 100).toFixed(0)}% of ${money(vat.netTaxableBase)}`}
              testId="acct-stat-due"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6 items-stretch">
            <Card className="p-4 flex flex-col" data-testid="accounting-vat-return">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-navy dark:text-dk-texthi flex items-center gap-2">
                  <Calculator size={16} className="text-brand" />{t('dashboard.vatReturn')}</h2>
                <Badge tone="info">{t('period.quarterly')}</Badge>
              </div>

              <div className="flex-1">
                {[
                  { label: t('common:label.totalsalesexvat'), base: vat.salesBase, vat: vat.salesVat, sign: '+' },
                  { label: t('common:label.totalreturnsexvat'), base: vat.returnsBase, vat: vat.returnsVat, sign: '−' },
                  { label: t('common:label.totalpurchasesexpensesexvat'), base: vat.purchasesBase, vat: vat.purchasesVat, sign: '−' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 py-1.5 border-b border-line/70 dark:border-dk-border/70">
                    <p className="text-sm text-navy dark:text-dk-text min-w-0">{row.label}</p>
                    <div className="text-end shrink-0">
                      <p className={clsx('tabular-nums font-medium text-sm', row.sign === '−' && 'text-danger-strong')}>
                        {row.sign} {money(row.base)}
                      </p>
                      <p className="text-[11px] text-muted tabular-nums">VAT {money(row.vat)}</p>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3 pt-2.5">
                  <p className="font-semibold text-navy dark:text-dk-texthi text-sm">{t('dashboard.netTaxableBase')}</p>
                  <p className="text-lg font-bold tabular-nums text-navy dark:text-dk-texthi" data-testid="acct-net-base">
                    {money(vat.netTaxableBase)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t-2 border-line dark:border-dk-border">
                <p className="font-semibold text-navy dark:text-dk-texthi">
                  {vat.refundable ? t('dashboard.refundableFrom') : t('dashboard.dueTo')}
                </p>
                <p
                  className={clsx('text-2xl font-bold tabular-nums', vat.refundable ? 'text-brand' : 'text-danger-strong')}
                  data-testid="acct-due-vat"
                >
                  {money(vat.dueVat)}
                </p>
              </div>
            </Card>

            {zakat && (
              <Card className="p-4 flex flex-col" data-testid="accounting-zakat">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-navy dark:text-dk-texthi flex items-center gap-2">
                    <Landmark size={16} className="text-brand" />{t('dashboard.zakat')}</h2>
                  <Badge tone="info">{t('period.annual')}</Badge>
                </div>

                <div className="flex-1">
                  {[
                    { label: t('common:label.revenueafterreturnsexvat'), value: zakat.revenue, sign: '+' },
                    { label: t('common:label.costsrecordedbyhrexvat'), value: zakat.costs, sign: '−' },
                    { label: t('common:label.vatalreadypaidtozatca'), value: zakat.vatPaid, sign: '−' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 py-1.5 border-b border-line/70 dark:border-dk-border/70">
                      <p className="text-sm text-navy dark:text-dk-text min-w-0">{row.label}</p>
                      <p className={clsx('tabular-nums font-medium text-sm shrink-0', row.sign === '−' && 'text-danger-strong')}>
                        {row.sign} {money(row.value)}
                      </p>
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-3 pt-2.5">
                    <p className="font-semibold text-navy dark:text-dk-texthi text-sm">{t('dashboard.netProfit')}</p>
                    <p className="text-lg font-bold tabular-nums text-navy dark:text-dk-texthi" data-testid="acct-net-profit">
                      {money(zakat.netProfit)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t-2 border-line dark:border-dk-border">
                  <div>
                    <p className="font-semibold text-navy dark:text-dk-texthi">{t('dashboard.zakatDue')}</p>
                    <p className="text-xs text-muted">{t('dashboard.ofNetProfit', { rate: (zakat.zakatRate * 100).toFixed(1) })}</p>
                  </div>
                  <p
                    className={clsx('text-2xl font-bold tabular-nums', zakat.profitable ? 'text-danger-strong' : 'text-muted')}
                    data-testid="acct-zakat-due"
                  >
                    {money(zakat.zakatDue)}
                  </p>
                </div>

                {!zakat.profitable && (
                  <p className="text-xs text-muted mt-2" data-testid="acct-zakat-note">{t('dashboard.zakatNotDue')}</p>
                )}
              </Card>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-between mb-2">
        <SectionTitle>{t('dashboard.byActivity')}</SectionTitle>
        <span className="text-xs text-muted">{t('dashboard.shareOfSales')}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="accounting-activities">
        {active.map((a: ActivityFigures) => {
          const meta = ENGINE_META[a.engineKind]
          return (
            <Card key={a.engineKind} className="p-4" data-testid={`acct-activity-${a.engineKind}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-2">
                  {meta && <Icon name={meta.icon} size={16} className="text-brand" />}
                  {bilingual(a.label)}
                </p>
                <span className="text-xs text-muted tabular-nums">
                  {summary.totals.salesBase > 0 ? ((a.salesBase / summary.totals.salesBase) * 100).toFixed(0) : 0}%
                </span>
              </div>

              <div className="h-1.5 rounded-full bg-line dark:bg-dk-border overflow-hidden mb-3">
                <div className="h-full bg-brand rounded-full" style={{ width: `${(a.salesBase / topSales) * 100}%` }} />
              </div>

              <p className="text-xl font-bold tabular-nums text-navy dark:text-dk-texthi">{money(a.netBase)}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-2">{t('dashboard.netBase')}</p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                {[
                  { label: t('common:label.sales'), value: a.salesBase },
                  { label: t('common:label.vat'), value: a.salesVat },
                  { label: t('common:label.inclvat'), value: a.salesTotal },
                  { label: t('common:label.returns'), value: a.returnsBase },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-2">
                    <span className="text-muted text-xs">{row.label}</span>
                    <span className="tabular-nums text-xs">{money(row.value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <SectionTitle className="mb-2 flex items-center gap-2">
        <FileSpreadsheet size={16} />{t('dashboard.excelExports')}</SectionTitle>
      <Card className="p-4 mb-6" data-testid="accounting-exports">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="font-semibold text-navy dark:text-dk-texthi text-sm">{t('dashboard.oneActivity')}</p>
            <p className="text-xs text-muted mb-2.5">{t('dashboard.oneActivityHint')}</p>
            <div className="flex flex-wrap gap-2">
              {REPORTED_ACTIVITIES.map((kind) => (
                <Button
                  key={kind}
                  variant="secondary"
                  onClick={() => downloadActivity(kind)}
                  loading={busy === kind}
                  data-testid={`accounting-export-${kind}`}
                >
                  <FileSpreadsheet size={16} /> {t(`common:engine.${kind}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="lg:border-s lg:border-line dark:lg:border-dk-border lg:ps-6">
            <p className="font-semibold text-navy dark:text-dk-texthi text-sm">{t('dashboard.allActivities')}</p>
            <p className="text-xs text-muted mb-2.5">{t('dashboard.allActivitiesHint')}</p>
            <Button onClick={downloadAll} loading={busy === 'all'} data-testid="accounting-export-all">
              <FileSpreadsheet size={16} />{t('dashboard.exportAll')}</Button>
          </div>
        </div>
      </Card>

      <SectionTitle className="mb-2">{t('dashboard.transactionDetail')}</SectionTitle>
      <DataTable
        testId="accounting-ledger-table"
        rows={rows}
        keyOf={(r: LedgerRow, i?: number) => `${r.reference}-${r.date}-${i ?? 0}`}
        pageSize={15}
        initialSort={{ key: 'date', dir: 'desc' }}
        empty={{ title: t('dashboard.noRows'), message: t('dashboard.widen') }}
        columns={[
          {
            key: 'date',
            header: t('common:column.date'),
            sortValue: (r: LedgerRow) => r.date,
            render: (r: LedgerRow) => <span className="tabular-nums text-sm">{new Date(r.date).toISOString().slice(0, 10)}</span>,
          },
          {
            key: 'type',
            header: t('common:column.process'),
            filter: {
              kind: 'select',
              options: [
                { label: t('common:label.sale'), value: 'SALE' },
                { label: t('common:label.return'), value: 'RETURN' },
                { label: t('common:label.expense'), value: 'EXPENSE' },
              ],
              value: (r: LedgerRow) => r.entryType,
            },
            render: (r: LedgerRow) => (
              <Badge tone={r.entryType === 'RETURN' ? 'warning' : r.entryType === 'EXPENSE' ? 'neutral' : 'success'}>
                {t(`status:ledgerEntry.${r.entryType}`, { defaultValue: r.entryType })}
              </Badge>
            ),
          },
          {
            key: 'details',
            header: t('common:column.details'),
            filter: { kind: 'text', value: (r: LedgerRow) => `${r.details} ${r.reference}` },
            render: (r: LedgerRow) => (
              <div className="max-w-[300px]">
                <p className="text-sm truncate">{r.details}</p>
                <RefText className="text-muted">{r.reference}</RefText>
              </div>
            ),
          },
          {
            key: 'activity',
            header: t('common:column.activity'),
            filter: {
              kind: 'select',
              options: REPORTED_ACTIVITIES.map((k) => ({ label: t(`common:engine.${k}`), value: k })),
              value: (r: LedgerRow) => r.engineKind ?? '',
            },
            render: (r: LedgerRow) =>
              r.engineKind ? (t(`common:engine.${r.engineKind}`) ?? r.engineKind) : <span className="text-muted">—</span>,
          },
          {
            key: 'base',
            header: t('common:column.base'),
            align: 'right',
            sortValue: (r: LedgerRow) => r.baseAmount,
            render: (r: LedgerRow) => <span className="tabular-nums">{r.baseAmount.toFixed(2)}</span>,
          },
          {
            key: 'vat',
            header: t('common:column.vat'),
            align: 'right',
            sortValue: (r: LedgerRow) => r.vatAmount,
            render: (r: LedgerRow) => <span className="tabular-nums text-muted">{r.vatAmount.toFixed(2)}</span>,
          },
          {
            key: 'total',
            header: t('common:column.total'),
            align: 'right',
            sortValue: (r: LedgerRow) => r.totalAmount,
            render: (r: LedgerRow) => <strong className="tabular-nums">{r.totalAmount.toFixed(2)}</strong>,
          },
        ]}
      />
    </div>
  )
}
