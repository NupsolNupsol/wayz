import { useParams } from 'react-router-dom'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { formatDate, formatDateTime } from '@/utils'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, CreditCard, Receipt, TriangleAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Card, SectionTitle, Spinner } from '@/components/ui'
import { RefLink, RefText } from '@/components/RefLink'
import { useCardTransaction, useLedgerPayment } from '@/hooks'
import { engineLabel } from '@/config/engineMeta'
import { money, schemeLabel } from './settlement'

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'danger' | 'muted' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-line/70 dark:border-dk-border/70 last:border-0">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className={clsx('text-sm text-end', tone === 'danger' && 'text-danger-strong', tone === 'muted' && 'text-muted')}>
        {value}
      </span>
    </div>
  )
}

function Verdict({ matched, lines, testId }: { matched: boolean; lines: string[]; testId: string }) {
  return (
    <Card className={clsx('p-4 mb-5 border-s-4', matched ? 'border-s-success' : 'border-s-amber-400')} data-testid={testId}>
      <p className="font-semibold text-navy dark:text-dk-texthi text-sm flex items-center gap-2">
        {matched ? <CheckCircle2 size={16} className="text-success" /> : <TriangleAlert size={16} className="text-amber-500" />}
        {matched ? 'This reconciles' : 'This does not reconcile'}
      </p>
      {lines.map((line) => (
        <p key={line} className="text-sm text-muted mt-1">
          {line}
        </p>
      ))}
    </Card>
  )
}

export function TransactionDetailPage() {
  const { t } = useTranslation(['accounting', 'common'])
  const statusLabel = useStatusLabel()
  const { id = '' } = useParams()
  const { data: txn, isLoading } = useCardTransaction(id)

  if (isLoading || !txn) {
    return (
      <div data-testid="transaction-detail">
        <PageHeader title={t('detail.transaction')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const r = txn.reconciliation
  const lines = r.matched
    ? ['The platform recorded the same amount on the same card.']
    : [
        !txn.payment
          ? 'The platform has no payment for this transaction — it was taken on the card machine but never rung up.'
          : !r.amountAgrees
            ? `The platform recorded ${money(txn.payment.amount)} against the terminal's ${money(txn.grossAmount)}.`
            : `The terminal reports ${schemeLabel(txn.scheme)}; the agent recorded ${
                txn.payment.cardScheme ? schemeLabel(txn.payment.cardScheme) : 'no card'
              }.`,
        'The commission always follows the terminal, so the money is right — the platform record is what needs correcting.',
      ]

  return (
    <div data-testid="transaction-detail">
      <PageHeader
        title={txn.externalRef}
        subtitle={`Card transaction · ${schemeLabel(txn.scheme)} · ${txn.source}`}
        crumbs={[
          { label: t('common:crumb.accounting') },
          { label: t('common:crumb.transactions'), to: '/accounting/settlement/transactions' },
          { label: txn.externalRef },
        ]}
      />

      <Verdict matched={r.matched} lines={lines} testId="transaction-verdict" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <CreditCard size={16} />{t('detail.terminalReported')}</SectionTitle>
          <Card className="p-4" data-testid="transaction-terminal">
            <Row label="Reference" value={<RefText>{txn.externalRef}</RefText>} />
            <Row label="Card" value={schemeLabel(txn.scheme)} />
            <Row label={t('detail.maskedNumber')} value={<RefText>{txn.maskedPan || '—'}</RefText>} />
            <Row label={t('detail.authCode')} value={<RefText>{txn.authCode || '—'}</RefText>} />
            <Row label={t('detail.terminal')} value={<RefText>{txn.terminalId || '—'}</RefText>} />
            <Row label={t('detail.source')} value={txn.source} />
            <Row label={t('detail.captured')} value={formatDateTime(new Date(txn.capturedAt).getTime())} />
            <Row label={t('detail.settlement')} value={txn.settlementDate ? formatDate(new Date(txn.settlementDate).getTime()) : 'not settled yet'} />
            <Row label="Status" value={<Badge tone={txn.status === 'SETTLED' ? 'success' : 'info'}>{statusLabel(txn.status, 'payment')}</Badge>} />
          </Card>
        </div>

        <div>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <Receipt size={16} />{t('detail.theMoney')}</SectionTitle>
          <Card className="p-4 mb-4" data-testid="transaction-money">
            <Row label={t('detail.grossInclVat')} value={<strong className="tabular-nums">{money(txn.grossAmount)}</strong>} />
            <Row label={t('detail.baseExVat')} value={<span className="tabular-nums">{money(txn.baseAmount)}</span>} />
            <Row label="VAT" value={<span className="tabular-nums">{money(txn.vatAmount)}</span>} />
            <Row
              label={`Commission at ${(txn.commissionRate * 100).toFixed(2)}%`}
              value={<span className="tabular-nums">−{money(txn.commissionAmount)}</span>}
              tone="danger"
            />
            <Row label={t('detail.netSettled')} value={<strong className="tabular-nums">{money(txn.netSettled)}</strong>} />
            <Row
              label="Activity"
              value={txn.engineKind ? (engineLabel(txn.engineKind)) : '—'}
              tone={txn.engineKind ? undefined : 'muted'}
            />
          </Card>

          <SectionTitle className="mb-2">{t('detail.platformSide')}</SectionTitle>
          <Card className="p-4" data-testid="transaction-platform">
            {txn.payment ? (
              <>
                <Row
                  label={t('detail.payment')}
                  value={
                    <RefLink to={`/accounting/settlement/payments/${txn.payment._id}`} testId="transaction-to-payment">
                      {txn.payment._id}
                    </RefLink>
                  }
                />
                <Row label={t('detail.amountRecorded')} value={<span className="tabular-nums">{money(txn.payment.amount)}</span>} />
                <Row
                  label={t('detail.cardAgentPicked')}
                  value={txn.payment.cardScheme ? schemeLabel(txn.payment.cardScheme) : '—'}
                  tone={r.schemeAgrees ? undefined : 'danger'}
                />
                <Row label="Booking" value={txn.booking ? txn.booking.ref : '—'} />
                <Row label="Customer" value={txn.booking?.customerName || '—'} />
                {r.difference !== null && Math.abs(r.difference) >= 0.01 && (
                  <Row label={t('detail.difference')} value={<strong className="tabular-nums">{r.difference.toFixed(2)}</strong>} tone="danger" />
                )}
              </>
            ) : (
              <p className="text-sm text-muted" data-testid="transaction-no-payment">
                The platform has no payment for this transaction. Somebody took money on the card machine without
                ringing it up.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export function PaymentDetailPage() {
  const { t } = useTranslation(['accounting', 'common'])
  const statusLabel = useStatusLabel()
  const { id = '' } = useParams()
  const { data: payment, isLoading } = useLedgerPayment(id)

  if (isLoading || !payment) {
    return (
      <div data-testid="payment-detail">
        <PageHeader title={t('detail.payment')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const r = payment.reconciliation
  const lines = !r.expectedAtTerminal
    ? ['Cash never goes through a card machine, so the terminal is not expected to have seen it.']
    : r.matched
      ? ['The terminal reported the same amount on the same card.']
      : [
          !payment.transaction
            ? 'The terminal never reported this payment. Either the feed has not caught up, or it was recorded against the wrong method.'
            : !r.amountAgrees
              ? `The terminal reports ${money(payment.transaction.grossAmount)} against the platform's ${money(payment.amount)}.`
              : `The agent recorded ${payment.cardScheme ? schemeLabel(payment.cardScheme) : 'no card'}; the terminal reports ${
                  payment.transaction ? schemeLabel(payment.transaction.scheme) : '—'
                }.`,
        ]

  return (
    <div data-testid="payment-detail">
      <PageHeader
        title={payment._id}
        subtitle={`${statusLabel(payment.kind, 'paymentKind')} · ${payment.method === 'CASH' ? 'Cash' : (payment.cardScheme ? schemeLabel(payment.cardScheme) : 'Card')}`}
        crumbs={[
          { label: t('common:crumb.accounting') },
          { label: t('common:crumb.payments'), to: '/accounting/settlement/payments' },
          { label: payment._id },
        ]}
      />

      <Verdict matched={r.matched || !r.expectedAtTerminal} lines={lines} testId="payment-verdict" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <Receipt size={16} />{t('detail.platformRecorded')}</SectionTitle>
          <Card className="p-4" data-testid="payment-platform">
            <Row label={t('detail.payment')} value={<RefText>{payment._id}</RefText>} />
            <Row label="Booking" value={payment.ref} />
            <Row label="Customer" value={payment.customerName || '—'} />
            <Row label="Type" value={<Badge tone={payment.kind === 'REFUND' ? 'warning' : 'success'}>{statusLabel(payment.kind, 'paymentKind')}</Badge>} />
            <Row
              label="Method"
              value={payment.method === 'CASH' ? 'Cash' : `Card · ${payment.cardScheme ? schemeLabel(payment.cardScheme) : 'unnamed'}`}
            />
            <Row
              label="Activity"
              value={payment.engineKind ? (engineLabel(payment.engineKind)) : '—'}
            />
            <Row label={t('detail.takenBy')} value={payment.takenByName} />
            <Row label={t('detail.taken')} value={formatDateTime(new Date(payment.createdAt).getTime())} />
            <Row label="Status" value={<Badge tone={payment.status === 'CAPTURED' ? 'success' : 'warning'}>{statusLabel(payment.status, 'payment')}</Badge>} />
          </Card>
        </div>

        <div>
          <SectionTitle className="mb-2">{t('detail.theMoney')}</SectionTitle>
          <Card className="p-4 mb-4" data-testid="payment-money">
            <Row label={t('detail.baseExVat')} value={<span className="tabular-nums">{money(payment.baseAmount)}</span>} />
            <Row label={`VAT at ${(payment.vatRate * 100).toFixed(0)}%`} value={<span className="tabular-nums">{money(payment.vatAmount)}</span>} />
            <Row label="Total" value={<strong className="tabular-nums">{money(payment.amount)}</strong>} />
          </Card>

          <SectionTitle className="mb-2 flex items-center gap-2">
            <CreditCard size={16} />{t('detail.terminalSide')}</SectionTitle>
          <Card className="p-4" data-testid="payment-terminal">
            {payment.transaction ? (
              <>
                <Row
                  label={t('detail.transaction')}
                  value={
                    <RefLink to={`/accounting/settlement/transactions/${payment.transaction._id}`} testId="payment-to-transaction">
                      {payment.transaction.externalRef}
                    </RefLink>
                  }
                />
                <Row
                  label={t('detail.cardTerminalSaw')}
                  value={schemeLabel(payment.transaction.scheme)}
                  tone={r.schemeAgrees ? undefined : 'danger'}
                />
                <Row label="Gross" value={<span className="tabular-nums">{money(payment.transaction.grossAmount)}</span>} />
                <Row
                  label={`Commission at ${(payment.transaction.commissionRate * 100).toFixed(2)}%`}
                  value={<span className="tabular-nums">−{money(payment.transaction.commissionAmount)}</span>}
                  tone="danger"
                />
                <Row label={t('detail.netSettled')} value={<strong className="tabular-nums">{money(payment.transaction.netSettled)}</strong>} />
                <Row label={t('detail.captured')} value={formatDateTime(new Date(payment.transaction.capturedAt).getTime())} />
              </>
            ) : (
              <p className="text-sm text-muted" data-testid="payment-no-transaction">
                {r.expectedAtTerminal
                  ? 'No card transaction has been matched to this payment yet.'
                  : 'Cash — there is nothing for the terminal to have reported.'}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
