import { useState } from 'react'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { useTranslation } from 'react-i18next'
import { Banknote, CreditCard, Receipt, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Card, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { RefLink } from '@/components/RefLink'
import { Select } from '@/components/Select'
import { usePaymentLedger } from '@/hooks'
import { engineLabel } from '@/config/engineMeta'
import { CARD_SCHEMES, type CardScheme } from '@/config/cardSchemes'
import type { LedgerPayment } from '@/api/accounting.api'
import { PeriodBar } from './SettlementShared'
import { isoDaysAgo, money, schemeLabel } from './settlement'

const KINDS = ['SALE', 'REFUND', 'DEPOSIT', 'OVERTIME', 'DAMAGE_CHARGE']

export function PaymentsPage() {
  const { t } = useTranslation(['accounting', 'common'])
  const statusLabel = useStatusLabel()
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState<'' | 'CASH' | 'CARD'>('')

  const filter = { from, to, ...(method ? { method } : {}) }
  const { data: rows = [], isLoading } = usePaymentLedger(filter)

  const sales = rows.filter((r) => r.kind !== 'REFUND')
  const refunds = rows.filter((r) => r.kind === 'REFUND')
  const cash = sales.filter((r) => r.method === 'CASH')
  const card = sales.filter((r) => r.method === 'CARD')
  const sum = (list: LedgerPayment[]) => list.reduce((t, r) => t + r.amount, 0)

  return (
    <div data-testid="payments-page">
      <PageHeader
        title={t('payments.title')}
        subtitle={t('payments.subtitle')}
        crumbs={[{ label: t('common:crumb.accounting') }, { label: t('common:crumb.settlement') }, { label: t('common:crumb.payments') }]}
        helpId="accounting-payments"
      />

      <Card className="p-3 mb-4">
        <PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} testId="payments">
          <div className="w-[170px]">
            <Select
              value={method}
              onChange={(v) => setMethod(v as '' | 'CASH' | 'CARD')}
              options={[
                { label: t('common:label.cashandcard'), value: '' },
                { label: t('common:label.cashonly'), value: 'CASH' },
                { label: t('common:label.cardonly'), value: 'CARD' },
              ]}
              testId="payments-method"
            />
          </div>
        </PeriodBar>
      </Card>

      {isLoading && !rows.length && (
        <div className="mb-4">
          <Spinner label={t('payments.reading')} />
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard
          label={t('payments.taken')}
          value={sales.length}
          icon={<Receipt size={18} />}
          tone="neutral"
          sublabel={t('payments.inTotal', { amount: money(sum(sales)) })}
          testId="pay-stat-count"
        />
        <StatCard label={t('common:label.cash')} value={money(sum(cash))} icon={<Banknote size={18} />} tone="info" sublabel={t('payments.paymentCount', { count: cash.length })} testId="pay-stat-cash" />
        <StatCard label={t('common:label.card')} value={money(sum(card))} icon={<CreditCard size={18} />} tone="success" sublabel={t('payments.paymentCount', { count: card.length })} testId="pay-stat-card" />
        <StatCard
          label={t('status:payment.REFUNDED')}
          value={money(sum(refunds))}
          icon={<Undo2 size={18} />}
          tone={refunds.length ? 'warning' : 'neutral'}
          sublabel={t('payments.refundCount', { count: refunds.length })}
          testId="pay-stat-refunds"
        />
      </div>

      <DataTable
        testId="payments-table"
        rows={rows}
        keyOf={(r: LedgerPayment) => r._id}
        pageSize={15}
        initialSort={{ key: 'when', dir: 'desc' }}
        empty={{ title: t('payments.noRows'), message: t('dashboard.widen') }}
        columns={[
          {
            key: 'ref',
            header: t('common:column.reference'),
            sortValue: (r: LedgerPayment) => r._id,
            filter: { kind: 'text', value: (r: LedgerPayment) => `${r._id} ${r.ref} ${r.customerName}` },
            render: (r: LedgerPayment) => (
              <div>
                <RefLink to={`/accounting/settlement/payments/${r._id}`} testId={`payment-ref-${r._id}`}>
                  {r._id}
                </RefLink>
                <p className="text-[11px] text-muted">{r.ref !== r._id ? r.ref : '—'}</p>
              </div>
            ),
          },
          {
            key: 'when',
            header: t('common:column.taken'),
            sortValue: (r: LedgerPayment) => r.createdAt,
            render: (r: LedgerPayment) => <span className="tabular-nums text-sm">{new Date(r.createdAt).toISOString().slice(0, 10)}</span>,
          },
          {
            key: 'customer',
            header: t('common:column.customer'),
            filter: { kind: 'text', value: (r: LedgerPayment) => r.customerName },
            render: (r: LedgerPayment) => <span className="text-sm">{r.customerName || '—'}</span>,
          },
          {
            key: 'method',
            header: t('common:column.method'),
            filter: {
              kind: 'select',
              options: [
                { label: t('common:label.cash'), value: 'CASH' },
                { label: t('common:label.card'), value: 'CARD' },
              ],
              value: (r: LedgerPayment) => r.method,
            },
            render: (r: LedgerPayment) =>
              r.method === 'CASH' ? (
                <Badge tone="neutral">{t('common:label.cash')}</Badge>
              ) : (
                <Badge tone="info">{r.cardScheme ? schemeLabel(r.cardScheme) : 'Card'}</Badge>
              ),
          },
          {
            key: 'scheme',
            header: t('common:column.card'),
            filter: {
              kind: 'select',
              options: CARD_SCHEMES.map((s: CardScheme) => ({ label: schemeLabel(s), value: s })),
              value: (r: LedgerPayment) => r.cardScheme ?? '',
            },
            render: (r: LedgerPayment) =>
              r.cardScheme ? <span className="text-sm">{schemeLabel(r.cardScheme)}</span> : <span className="text-muted">—</span>,
          },
          {
            key: 'kind',
            header: t('common:column.type'),
            filter: { kind: 'select', options: KINDS.map((k) => ({ label: k, value: k })), value: (r: LedgerPayment) => r.kind },
            render: (r: LedgerPayment) => (
              <Badge tone={r.kind === 'REFUND' ? 'warning' : 'success'}>{statusLabel(r.kind, 'paymentKind')}</Badge>
            ),
          },
          {
            key: 'activity',
            header: t('common:column.activity'),
            render: (r: LedgerPayment) =>
              r.engineKind ? (engineLabel(r.engineKind)) : <span className="text-muted">—</span>,
          },
          {
            key: 'base',
            header: t('common:column.exvat'),
            align: 'right',
            sortValue: (r: LedgerPayment) => r.baseAmount,
            render: (r: LedgerPayment) => <span className="tabular-nums">{r.baseAmount.toFixed(2)}</span>,
          },
          {
            key: 'amount',
            header: t('common:column.total'),
            align: 'right',
            sortValue: (r: LedgerPayment) => r.amount,
            render: (r: LedgerPayment) => (
              <strong className={r.kind === 'REFUND' ? 'tabular-nums text-danger-strong' : 'tabular-nums'}>
                {r.kind === 'REFUND' ? '−' : ''}
                {r.amount.toFixed(2)}
              </strong>
            ),
          },
          {
            key: 'terminal',
            header: t('common:column.attheterminal'),
            align: 'right',
            render: (r: LedgerPayment) =>
              r.transactionId ? (
                <RefLink to={`/accounting/settlement/transactions/${r.transactionId}`} testId={`payment-txn-${r._id}`}>
                  {r.externalRef}
                </RefLink>
              ) : r.method === 'CARD' && r.kind !== 'REFUND' ? (
                <Badge tone="danger">{t('payments.notReported')}</Badge>
              ) : (
                <span className="text-muted text-xs">n/a</span>
              ),
          },
        ]}
      />
    </div>
  )
}
