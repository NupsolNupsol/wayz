import { useEffect, useRef, useState } from 'react'
import { bilingual } from './bilingual'
import { useTranslation } from 'react-i18next'
import { CreditCard, Landmark, Percent, RotateCcw, Save, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { Badge, Button, Card, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { useCommissionRates, useTransactionSummary, useUpdateCommissionRates } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import type { CardScheme, SchemeFigures } from '@/api/accounting.api'

const money = (n: number) => `${n.toFixed(2)} SAR`
const percent = (rate: number) => `${(rate * 100).toFixed(2)}%`

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function CommissionRates() {
  const { t } = useTranslation(['accounting', 'common'])
  const { data: rates, isLoading } = useCommissionRates()
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const { data: summary } = useTransactionSummary({ from, to })
  const save = useUpdateCommissionRates()

  const [draft, setDraft] = useState<Record<string, string>>({})
  const [reprice, setReprice] = useState(true)

  const seeded = useRef(false)
  useEffect(() => {
    if (!rates || seeded.current) return
    seeded.current = true
    setDraft(Object.fromEntries(rates.map((r) => [r.scheme, (r.rate * 100).toFixed(2)])))
  }, [rates])

  if (isLoading || !rates) {
    return (
      <div data-testid="commission-rates">
        <PageHeader title={t('commissions.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const parsed = (scheme: CardScheme) => {
    const percentage = Number(draft[scheme] ?? '')
    return Number.isFinite(percentage) && (draft[scheme] ?? '') !== '' ? Number((percentage / 100).toFixed(6)) : NaN
  }
  const same = (a: number, b: number) => a.toFixed(6) === b.toFixed(6)
  const changed = rates.filter((r) => Number.isFinite(parsed(r.scheme)) && !same(parsed(r.scheme), r.rate))
  const invalid = rates.some((r) => {
    const value = parsed(r.scheme)
    return !Number.isFinite(value) || value < 0 || value > 0.2
  })

  const submit = () => {
    const payload = Object.fromEntries(changed.map((r) => [r.scheme, parsed(r.scheme)])) as Partial<Record<CardScheme, number>>
    save.mutate(
      { rates: payload, repriceUnsettled: reprice },
      {
        onSuccess: (res) => {
          setDraft(Object.fromEntries(res.rates.map((r) => [r.scheme, (r.rate * 100).toFixed(2)])))
          toast(
            'success',
            'Commission rates saved',
            res.repriced
              ? `${res.repriced} transaction${res.repriced === 1 ? '' : 's'} not yet settled were re-priced.`
              : 'They apply to every transaction imported from now on.',
          )
        },
        onError: (e) => toast('danger', t('commissions.notSaved'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const resetAll = () => setDraft(Object.fromEntries(rates.map((r) => [r.scheme, (r.defaultRate * 100).toFixed(2)])))

  return (
    <div data-testid="commission-rates">
      <PageHeader
        title={t('commissions.title')}
        subtitle={t('commissions.subtitle')}
        crumbs={[{ label: t('common:crumb.accounting') }, { label: t('commissions.crumb') }]}
        helpId="accounting-commissions"
        actions={
          <>
            <Button variant="ghost" onClick={resetAll} data-testid="commission-reset">
              <RotateCcw size={16} />{t('commissions.restore')}</Button>
            <Button onClick={submit} loading={save.isPending} disabled={!changed.length || invalid} data-testid="commission-save">
              <Save size={16} />{t('commissions.saveRates')}</Button>
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <StatCard
            label={t('commissions.cardVolume')}
            value={money(summary.totals.grossAmount)}
            icon={<CreditCard size={18} />}
            tone="info"
            sublabel={t('dashboard.transactionsCount', { count: summary.totals.count })}
            testId="commission-stat-gross"
          />
          <StatCard
            label={t('commissions.withheld')}
            value={money(summary.totals.commissionAmount)}
            icon={<Percent size={18} />}
            tone="warning"
            sublabel={t('commissions.asExpense')}
            testId="commission-stat-commission"
          />
          <StatCard
            label={t('commissions.netSettled')}
            value={money(summary.totals.netSettled)}
            icon={<Landmark size={18} />}
            tone="success"
            testId="commission-stat-net"
          />
          <StatCard
            label={t('commissions.effectiveRate')}
            value={percent(summary.totals.effectiveRate)}
            icon={<Wallet size={18} />}
            tone="neutral"
            sublabel={t('commissions.blended')}
            testId="commission-stat-effective"
          />
        </div>
      )}

      <SectionTitle className="mb-2">{t('commissions.contractRates')}</SectionTitle>
      <Card className="p-4 mb-6" data-testid="commission-rate-table">
        <p className="text-xs text-muted mb-2">{t('commissions.contractHint')}</p>

        <DataTable
          testId="commission-rate-rows"
          rows={rates}
          keyOf={(r) => r.scheme}
          pageSize={10}
          columns={[
            {
              key: 'scheme',
              header: t('commissions.cardType'),
              sortValue: (r) => bilingual(r.label),
              render: (r) => (
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-navy dark:text-dk-texthi">{bilingual(r.label)}</span>
                  {!r.isDefault && <Badge tone="info">edited</Badge>}
                </span>
              ),
            },
            {
              key: 'rate',
              header: t('common:column.rate'),
              render: (r) => {
                const value = parsed(r.scheme)
                const bad = !Number.isFinite(value) || value < 0 || value > 0.2
                return (
                  <div className="w-28">
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step="0.01"
                        className="lf-input tabular-nums h-9 px-2.5 pe-6"
                        value={draft[r.scheme] ?? ''}
                        onChange={(e) => setDraft({ ...draft, [r.scheme]: e.target.value })}
                        data-testid={`commission-rate-${r.scheme}`}
                      />
                      <span className="absolute end-2 top-1/2 -translate-y-1/2 text-muted text-xs">%</span>
                    </div>
                    {bad && <p className="text-[11px] text-danger-strong mt-0.5">0 to 20 only.</p>}
                  </div>
                )
              },
            },
            { key: 'contract', header: t('commissions.contract'), render: (r) => <span className="text-muted tabular-nums text-xs">{percent(r.defaultRate)}</span> },
            {
              key: 'withheld',
              header: t('commissions.withheldShort'),
              align: 'right',
              render: (r) => {
                const figures = summary?.byScheme.find((sc: SchemeFigures) => sc.scheme === r.scheme)
                return (
                  <span className="tabular-nums font-semibold" data-testid={`commission-withheld-${r.scheme}`}>
                    {figures ? money(figures.commissionAmount) : '—'}
                  </span>
                )
              },
            },
          ]}
        />

        <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer">
          <input type="checkbox" checked={reprice} onChange={(e) => setReprice(e.target.checked)} data-testid="commission-reprice" />
          <span className="text-navy dark:text-dk-text">{t('commissions.reprice')}</span>
        </label>
      </Card>

      <Card className="p-3 mb-6 border-s-4 border-s-amber-400" data-testid="commission-treatment">
        <p className="font-semibold text-navy dark:text-dk-texthi text-sm">{t('commissions.howBooked')}</p>
        <p className="text-xs text-muted mt-0.5">
          {t('commissions.howBookedNote')}
        </p>
      </Card>

      <SectionTitle className="mb-2">{t('commissions.byScheme')}</SectionTitle>
      <Card className="p-4" data-testid="commission-scheme-table">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('period.label')}</span>
          <input type="date" className="lf-input h-9 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="commission-from" />
          <span className="text-muted">to</span>
          <input type="date" className="lf-input h-9 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} data-testid="commission-to" />
        </div>

        <DataTable
          testId="commission-scheme-rows"
          rows={summary?.byScheme ?? []}
          keyOf={(r: SchemeFigures) => r.scheme}
          pageSize={10}
          empty={{ title: 'No card takings in this period', message: 'Pick another period, or import the terminal file.' }}
          columns={[
            { key: 'scheme', header: t('commissions.cardType'), sortValue: (r: SchemeFigures) => bilingual(r.label), render: (r: SchemeFigures) => <span className="font-medium text-navy dark:text-dk-texthi">{bilingual(r.label)}</span> },
            { key: 'rate', header: t('commissions.rate'), align: 'right', sortValue: (r: SchemeFigures) => r.rate, render: (r: SchemeFigures) => <span className="tabular-nums text-muted">{percent(r.rate)}</span> },
            { key: 'count', header: t('common:column.transactions'), align: 'right', sortValue: (r: SchemeFigures) => r.count, render: (r: SchemeFigures) => <span className="tabular-nums">{r.count}</span> },
            { key: 'gross', header: t('commissions.gross'), align: 'right', sortValue: (r: SchemeFigures) => r.grossAmount, render: (r: SchemeFigures) => <span className="tabular-nums">{r.grossAmount.toFixed(2)}</span> },
            { key: 'commission', header: t('commissions.commission'), align: 'right', sortValue: (r: SchemeFigures) => r.commissionAmount, render: (r: SchemeFigures) => <span className="tabular-nums text-danger-strong">{r.commissionAmount.toFixed(2)}</span> },
            { key: 'net', header: t('common:column.netsettled'), align: 'right', sortValue: (r: SchemeFigures) => r.netSettled, render: (r: SchemeFigures) => <span className="tabular-nums">{r.netSettled.toFixed(2)}</span> },
            { key: 'share', header: t('commissions.share'), align: 'right', sortValue: (r: SchemeFigures) => r.share, render: (r: SchemeFigures) => <span className="tabular-nums text-muted">{r.share.toFixed(1)}%</span> },
          ]}
          footer={(shown: SchemeFigures[]) => {
            const gross = shown.reduce((t, r) => t + r.grossAmount, 0)
            const commission = shown.reduce((t, r) => t + r.commissionAmount, 0)
            return [
              t('commissions.totals'),
              <span className="tabular-nums">{percent(gross ? commission / gross : 0)}</span>,
              <span className="tabular-nums">{shown.reduce((t, r) => t + r.count, 0)}</span>,
              <span className="tabular-nums">{gross.toFixed(2)}</span>,
              <span className="tabular-nums text-danger-strong">{commission.toFixed(2)}</span>,
              <span className="tabular-nums">{shown.reduce((t, r) => t + r.netSettled, 0).toFixed(2)}</span>,
              <span className="tabular-nums">{shown.reduce((t, r) => t + r.share, 0).toFixed(1)}%</span>,
            ]
          }}
        />
      </Card>
    </div>
  )
}
