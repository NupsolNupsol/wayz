import { useState } from 'react'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { formatDate, formatTime } from '@/utils'
import { useTranslation } from 'react-i18next'
import { Banknote, CreditCard, Receipt as ReceiptIcon, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Button, Card, Field, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { useTillTransactions, useRefundPayment } from '@/hooks'
import { useAuthStore } from '@/store/auth'
import { can } from '@/permissions/permissions'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from './tillFormat'
import type { TillTransaction } from '@/api/till.api'

export function TillTransactions() {
  const { t } = useTranslation('till')
  const statusLabel = useStatusLabel()
  const { data: rows = [], isLoading } = useTillTransactions()
  const refund = useRefundPayment()
  const role = useAuthStore((s) => s.me?.role)
  const mayRefund = can(role, 'till.refund')

  const [refunding, setRefunding] = useState<TillTransaction | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const openRefund = (row: TillTransaction) => {
    setRefunding(row)
    setAmount(String(row.amount))
    setReason('')
  }

  const submitRefund = () => {
    if (!refunding) return
    refund.mutate(
      { paymentId: refunding._id, amount: Number(amount || 0), reason: reason.trim() },
      {
        onSuccess: (res) => {
          toast(
            'success',
            `${money(Number(amount || 0))} refunded`,
            res.remaining > 0 ? `${money(res.remaining)} still refundable on this payment.` : 'This payment is now fully refunded.',
          )
          setRefunding(null)
        },
        onError: (e) => toast('danger', t('transactions.refundRefused'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  if (isLoading) {
    return (
      <div data-testid="till-transactions">
        <PageHeader title={t('transactions.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const sales = rows.filter((r) => r.kind !== 'REFUND')
  const refunds = rows.filter((r) => r.kind === 'REFUND')
  const sum = (list: TillTransaction[]) => list.reduce((t, r) => t + r.amount, 0)

  return (
    <div data-testid="till-transactions">
      <PageHeader
        title={t('transactions.title')}
        subtitle={t('transactions.subtitle')}
        crumbs={[{ label: t('common:crumb.till') }, { label: t('common:crumb.transactions') }]}
        helpId="till-transactions"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <StatCard label={t('transactions.title')} value={rows.length} icon={<ReceiptIcon size={18} />} tone="neutral" testId="tx-stat-count" />
        <StatCard label={t('common:label.cash')} value={money(sum(sales.filter((r) => r.method === 'CASH')))} icon={<Banknote size={18} />} tone="info" testId="tx-stat-cash" />
        <StatCard label={t('common:label.card')} value={money(sum(sales.filter((r) => r.method !== 'CASH')))} icon={<CreditCard size={18} />} tone="info" testId="tx-stat-card" />
        <StatCard label={t('status:payment.REFUNDED')} value={money(sum(refunds))} icon={<Undo2 size={18} />} tone={refunds.length ? 'warning' : 'neutral'} testId="tx-stat-refunded" />
      </div>

      <DataTable
        testId="till-tx-table"
        rows={rows}
        keyOf={(r: TillTransaction) => r._id}
        initialSort={{ key: 'when', dir: 'desc' }}
        empty={{ title: t('transactions.noRows'), message: t('transactions.noRowsHint') }}
        columns={[
          {
            key: 'id',
            header: t('common:column.reference'),
            sortValue: (r: TillTransaction) => r._id,
            filter: { kind: 'text', value: (r: TillTransaction) => `${r._id} ${r.bookingRef} ${r.customerName} ${r.receiptRef ?? ''}` },
            render: (r: TillTransaction) => (
              <div>
                <RefText className="text-muted">{r._id}</RefText>
                <p className="font-semibold text-navy dark:text-dk-texthi">{r.customerName || '—'}</p>
              </div>
            ),
          },
          {
            key: 'what',
            header: t('common:column.for'),
            render: (r: TillTransaction) => (
              <div className="max-w-[240px]">
                <p className="text-sm truncate">{r.productName || '—'}</p>
                <RefText className="text-muted">{r.bookingRef}</RefText>
              </div>
            ),
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
              value: (r: TillTransaction) => r.method,
            },
            render: (r: TillTransaction) => (
              <Badge tone="neutral">
                {r.method === 'CASH' ? <Banknote size={12} className="me-1 inline" /> : <CreditCard size={12} className="me-1 inline" />}
                {statusLabel(r.method, 'method')}
              </Badge>
            ),
          },
          {
            key: 'kind',
            header: t('common:column.type'),
            filter: {
              kind: 'select',
              options: [
                { label: t('common:label.sale'), value: 'SALE' },
                { label: t('status:paymentKind.DEPOSIT'), value: 'DEPOSIT' },
                { label: t('status:paymentKind.REFUND'), value: 'REFUND' },
                { label: t('status:paymentKind.OVERTIME'), value: 'OVERTIME' },
              ],
              value: (r: TillTransaction) => r.kind,
            },
            render: (r: TillTransaction) => (
              <Badge tone={r.kind === 'REFUND' ? 'warning' : 'neutral'}>{statusLabel(r.kind, 'paymentKind')}</Badge>
            ),
          },
          {
            key: 'amount',
            header: t('common:column.amount'),
            align: 'right',
            sortValue: (r: TillTransaction) => r.amount,
            render: (r: TillTransaction) => (
              <strong className={r.kind === 'REFUND' ? 'tabular-nums text-danger-strong' : 'tabular-nums'}>
                {r.kind === 'REFUND' ? '−' : ''}
                {money(r.amount)}
              </strong>
            ),
          },
          {
            key: 'status',
            header: t('common:column.status'),
            filter: {
              kind: 'select',
              options: [
                { label: t('status:payment.CAPTURED'), value: 'CAPTURED' },
                { label: t('status:payment.REFUNDED'), value: 'REFUNDED' },
                { label: t('status:payment.PENDING'), value: 'PENDING' },
              ],
              value: (r: TillTransaction) => r.status,
            },
            render: (r: TillTransaction) => (
              <Badge tone={r.status === 'CAPTURED' ? 'success' : r.status === 'REFUNDED' ? 'warning' : 'neutral'}>{statusLabel(r.status, 'payment')}</Badge>
            ),
          },
          {
            key: 'by',
            header: t('common:column.takenby'),
            filter: { kind: 'text', value: (r: TillTransaction) => r.takenByName },
            sortValue: (r: TillTransaction) => r.takenByName,
            render: (r: TillTransaction) => (
              <span className="text-sm">{r.takenByName || <span className="text-muted">—</span>}</span>
            ),
          },
          {
            key: 'when',
            header: t('common:column.taken'),
            align: 'right',
            sortValue: (r: TillTransaction) => r.createdAt,
            render: (r: TillTransaction) => (
              <div className="text-end">
                <p className="text-sm tabular-nums">{formatTime(new Date(r.createdAt).getTime())}</p>
                <p className="text-[11px] text-muted">{formatDate(new Date(r.createdAt).getTime())}</p>
              </div>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r: TillTransaction) =>
              mayRefund && r.kind !== 'REFUND' && r.status === 'CAPTURED' ? (
                <Button variant="ghost" onClick={(e) => { e.stopPropagation(); openRefund(r) }} data-testid={`tx-refund-${r._id}`}>
                  <Undo2 size={15} /> {t('transactions.refund')}
                </Button>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
        ]}
      />

      <Modal
        open={!!refunding}
        onClose={() => setRefunding(null)}
        title={t('transactions.refundTitle')}
        subtitle={refunding ? `${refunding._id} · ${refunding.customerName || 'Walk-in'}` : undefined}
        testId="tx-refund-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefunding(null)}>{t('common:action.cancel')}</Button>
            <Button
              variant="danger"
              onClick={submitRefund}
              loading={refund.isPending}
              disabled={!(Number(amount) > 0) || reason.trim().length < 3}
              data-testid="tx-refund-submit"
            >
              <Undo2 size={16} /> {t('transactions.refundAmount', { amount: money(Number(amount || 0)) })}
            </Button>
          </>
        }
      >
        {refunding && (
          <>
            <Card className="p-3 mb-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">{t('transactions.originallyTaken')}</span>
                <strong className="tabular-nums">{money(refunding.amount)}</strong>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm text-muted">{t('common:field.method')}</span>
                <span>{refunding.method}</span>
              </div>
            </Card>

            <Field label={t('transactions.amountToGiveBack')} required hint={t('transactions.cannotExceed')}>
              <input
                type="number"
                min={0}
                step="0.01"
                max={refunding.amount}
                className="lf-input tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="tx-refund-amount"
              />
            </Field>

            <Field label={t('common:field.reason')} required hint={t('transactions.reasonHint')}>
              <textarea
                className="lf-input min-h-[80px]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('transactions.reasonPlaceholder')}
                data-testid="tx-refund-reason"
              />
            </Field>

            {refunding.method === 'CASH' && (
              <p className="text-xs text-muted">{t('transactions.fromYourDrawer')}</p>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
