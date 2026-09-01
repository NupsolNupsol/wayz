import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCheck, CreditCard, Scale, TriangleAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Card, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { RefLink } from '@/components/RefLink'
import { useReconciliation, useTransactionSummary } from '@/hooks'
import type { CardScheme } from '@/config/cardSchemes'
import type { ReconciliationRow } from '@/api/accounting.api'
import { PeriodBar } from './SettlementShared'
import { RECON_TONES, isoDaysAgo, money, reconLabel, schemeLabel, schemeOptions } from './settlement'

function detailPath(row: ReconciliationRow): string | null {
  if (row.transactionId) return `/accounting/settlement/transactions/${row.transactionId}`
  if (row.paymentId) return `/accounting/settlement/payments/${row.paymentId}`
  return null
}

export function ReconciliationPage() {
  const { t } = useTranslation(['accounting', 'common'])
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [scheme, setScheme] = useState<'' | CardScheme>('')

  const filter = { from, to, ...(scheme ? { scheme } : {}) }
  const { data: summary } = useTransactionSummary(filter)
  const { data: reconciliation } = useReconciliation(filter)

  return (
    <div data-testid="reconciliation-page">
      <PageHeader
        title={t('reconciliation.title')}
        subtitle={t('reconciliation.subtitle')}
        crumbs={[{ label: t('common:crumb.accounting') }, { label: t('common:crumb.settlement') }, { label: t('common:crumb.reconciliation') }]}
        helpId="accounting-reconciliation"
      />

      <Card className="p-3 mb-4">
        <PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} scheme={scheme} onScheme={setScheme} testId="recon-period" />
      </Card>

      {!summary && (
        <div className="mb-5" data-testid="reconciliation-loading">
          <Spinner label={t('reconciliation.reading')} />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <StatCard
            label={t('reconciliation.transactions')}
            value={summary.totals.count}
            icon={<CreditCard size={18} />}
            tone="neutral"
            sublabel={summary.credits.count ? t('reconciliation.refundedCount', { count: summary.credits.count }) : t('reconciliation.noneReversed')}
            testId="txn-stat-count"
          />
          <StatCard label={t('reconciliation.gross')} value={money(summary.totals.grossAmount)} icon={<CreditCard size={18} />} tone="info" testId="txn-stat-gross" />
          <StatCard
            label={t('reconciliation.commissionWithheld')}
            value={money(summary.totals.commissionAmount)}
            icon={<TriangleAlert size={18} />}
            tone="warning"
            testId="txn-stat-commission"
          />
          <StatCard label={t('reconciliation.netSettled')} value={money(summary.totals.netSettled)} icon={<CheckCheck size={18} />} tone="success" testId="txn-stat-net" />
        </div>
      )}

      {reconciliation && (
        <>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <Scale size={16} />{t('reconciliation.terminalAgainst')}</SectionTitle>
          <Card className="p-4 mb-6" data-testid="reconciliation-panel">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted font-semibold">{t('reconciliation.matched')}</p>
                <p className="text-2xl font-bold text-success tabular-nums" data-testid="recon-matched">{reconciliation.totals.matched}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted font-semibold">{t('reconciliation.amountDiffers')}</p>
                <p className="text-2xl font-bold text-amber-500 tabular-nums" data-testid="recon-mismatch">{reconciliation.totals.amountMismatch}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted font-semibold">{t('reconciliation.cardDiffers')}</p>
                <p className="text-2xl font-bold text-amber-500 tabular-nums" data-testid="recon-scheme-mismatch">
                  {reconciliation.totals.schemeMismatch}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted font-semibold">{t('reconciliation.onlyTerminal')}</p>
                <p className="text-2xl font-bold text-danger-strong tabular-nums" data-testid="recon-terminal-only">
                  {reconciliation.totals.missingInPlatform}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted font-semibold">{t('reconciliation.onlyPlatform')}</p>
                <p className="text-2xl font-bold text-danger-strong tabular-nums" data-testid="recon-platform-only">
                  {reconciliation.totals.missingAtTerminal}
                </p>
              </div>
              <p className="col-span-2 sm:col-span-5 text-xs text-muted -mt-2">
                {t('reconciliation.compared', { count: reconciliation.compared })}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line dark:border-dk-border">
              <div className="flex gap-6 text-sm">
                <span>
                  <span className="text-muted">{t('reconciliation.terminal')}</span>
                  <strong className="tabular-nums" data-testid="recon-terminal-total">{money(reconciliation.totals.terminal)}</strong>
                </span>
                <span>
                  <span className="text-muted">{t('reconciliation.platform')}</span>
                  <strong className="tabular-nums" data-testid="recon-platform-total">{money(reconciliation.totals.platform)}</strong>
                </span>
              </div>
              <Badge tone={reconciliation.totals.balanced ? 'success' : 'warning'}>
                {reconciliation.totals.balanced ? t('reconciliation.balanced') : t('reconciliation.needsAttention')}
              </Badge>
            </div>
          </Card>

          <SectionTitle className="mb-2">{t('reconciliation.notLiningUp')}</SectionTitle>
          <DataTable
            testId="recon-table"
            rows={reconciliation.rows}
            keyOf={(r: ReconciliationRow, i?: number) => `${r.transactionId ?? r.paymentId}-${i ?? 0}`}
            pageSize={12}
            initialSort={{ key: 'when', dir: 'desc' }}
            empty={{ title: t('reconciliation.allMatch'), message: t('reconciliation.allMatchHint') }}
            columns={[
              {
                key: 'ref',
                header: t('common:column.reference'),
                sortValue: (r: ReconciliationRow) => r.externalRef || (r.paymentId ?? ''),
                filter: { kind: 'text', value: (r: ReconciliationRow) => `${r.externalRef} ${r.paymentId ?? ''}` },
                render: (r: ReconciliationRow) => {
                  const to = detailPath(r)
                  const label = r.externalRef || r.paymentId || '—'
                  return (
                    <div>
                      {to ? (
                        <RefLink to={to} title={t('reconciliation.openRecord')} testId={`recon-ref-${r.transactionId ?? r.paymentId}`}>
                          {label}
                        </RefLink>
                      ) : (
                        <span className="font-mono text-xs">{label}</span>
                      )}
                      <p className="text-[11px] text-muted">
                        {r.transactionId ? t('reconciliation.cardTransaction') : t('reconciliation.platformPayment')}
                      </p>
                    </div>
                  )
                },
              },
              {
                key: 'issue',
                header: t('common:column.issue'),
                filter: {
                  kind: 'select',
                  options: (
                    ['AMOUNT_MISMATCH', 'SCHEME_MISMATCH', 'MISSING_IN_PLATFORM', 'MISSING_AT_TERMINAL'] as const
                  ).map((s) => ({ label: reconLabel(s), value: s })),
                  value: (r: ReconciliationRow) => r.status,
                },
                render: (r: ReconciliationRow) => <Badge tone={RECON_TONES[r.status]}>{reconLabel(r.status)}</Badge>,
              },
              {
                key: 'scheme',
                header: t('common:column.card'),
                filter: {
                  kind: 'select',
                  options: schemeOptions(),
                  value: (r: ReconciliationRow) => r.scheme ?? '',
                },
                render: (r: ReconciliationRow) =>
                  r.status === 'SCHEME_MISMATCH' ? (
                    <div className="text-xs">
                      <p className="text-navy dark:text-dk-text">
                        {t('reconciliation.terminalSaid')} <strong>{r.scheme ? schemeLabel(r.scheme) : '—'}</strong>
                      </p>
                      <p className="text-danger-strong">
                        {t('reconciliation.agentSaid')} <strong>{r.recordedScheme ? schemeLabel(r.recordedScheme) : '—'}</strong>
                      </p>
                    </div>
                  ) : r.scheme ? (
                    schemeLabel(r.scheme)
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                key: 'terminal',
                header: t('common:column.terminal'),
                align: 'right',
                sortValue: (r: ReconciliationRow) => r.terminalAmount ?? 0,
                render: (r: ReconciliationRow) =>
                  r.terminalAmount === null ? <span className="text-muted">—</span> : <span className="tabular-nums">{r.terminalAmount.toFixed(2)}</span>,
              },
              {
                key: 'platform',
                header: t('common:column.platform'),
                align: 'right',
                sortValue: (r: ReconciliationRow) => r.platformAmount ?? 0,
                render: (r: ReconciliationRow) =>
                  r.platformAmount === null ? <span className="text-muted">—</span> : <span className="tabular-nums">{r.platformAmount.toFixed(2)}</span>,
              },
              {
                key: 'difference',
                header: t('common:column.difference'),
                align: 'right',
                sortValue: (r: ReconciliationRow) => Math.abs(r.difference),
                render: (r: ReconciliationRow) => (
                  <strong className={clsx('tabular-nums', r.difference < 0 ? 'text-danger-strong' : 'text-amber-600')}>
                    {r.difference.toFixed(2)}
                  </strong>
                ),
              },
              {
                key: 'when',
                header: t('common:column.captured'),
                align: 'right',
                sortValue: (r: ReconciliationRow) => r.capturedAt ?? '',
                render: (r: ReconciliationRow) => (
                  <span className="text-xs text-muted">{r.capturedAt ? r.capturedAt.slice(0, 10) : '—'}</span>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}
