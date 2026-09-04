import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { CircleCheck, CircleX, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Field, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { RefLink } from '@/components/RefLink'
import { useRefundRequests, useReviewRefundRequest } from '@/hooks'
import { engineLabel, visibleEngineOptions } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { formatDateTime, money } from '@/utils'
import { toast } from '@/state/toastStore'
import type { RefundRequest, RefundRequestStatus } from '@/api/refundRequest.api'

const TONE: Record<RefundRequestStatus, 'info' | 'success' | 'danger'> = {
  PENDING: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export function RefundRequestsPage() {
  const { t } = useTranslation(['accounting', 'common'])
  const [status, setStatus] = useState<RefundRequestStatus | ''>('')
  const { data, isLoading } = useRefundRequests(status ? { status } : undefined)
  const review = useReviewRefundRequest()

  const [reviewing, setReviewing] = useState<RefundRequest | null>(null)
  const [note, setNote] = useState('')

  const rows = data?.rows ?? []
  const pending = rows.filter((r) => r.status === 'PENDING')

  const decide = (approve: boolean) => {
    if (!reviewing) return
    review.mutate(
      { id: reviewing._id, approve, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast(approve ? 'success' : 'warning', approve ? t('refunds.released') : t('refunds.refused'))
          setReviewing(null)
          setNote('')
        },
        onError: (e) =>
          toast('danger', t('common:error.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  return (
    <div data-testid="refund-requests">
      <PageHeader
        title={t('refunds.title')}
        subtitle={data?.canApprove ? t('refunds.subtitleApprover') : t('refunds.subtitleDesk')}
        crumbs={[{ label: t('refunds.title') }]}
        actions={
          <div
            className="inline-flex rounded-xl2 border border-line dark:border-dk-border bg-surface dark:bg-dk-elevated p-0.5 overflow-x-auto max-w-full"
            role="group"
            aria-label={t('common:column.status')}
            data-testid="refund-requests-status-filter"
          >
            {([['', 'common:table.all'], ['PENDING', 'refunds.status.PENDING'], ['APPROVED', 'refunds.status.APPROVED'], ['REJECTED', 'refunds.status.REJECTED']] as const).map(
              ([value, label]) => (
                <button
                  key={value || 'all'}
                  type="button"
                  onClick={() => setStatus(value as RefundRequestStatus | '')}
                  data-testid={`refund-status-${value || 'ALL'}`}
                  className={clsx(
                    'h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                    status === value ? 'bg-brand text-brand-fg' : 'text-muted hover:text-brand',
                  )}
                >
                  {t(label)}
                </button>
              ),
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <StatCard
          label={t('refunds.awaiting')}
          value={pending.length}
          icon={<Undo2 size={18} />}
          tone="info"
          testId="refund-requests-pending-count"
        />
        <StatCard
          label={t('refunds.awaitingValue')}
          value={money(data?.pendingTotal ?? 0)}
          tone="warning"
          testId="refund-requests-pending-total"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <DataTable
          testId="refund-requests-table"
          rows={rows}
          keyOf={(r) => r._id}
          empty={{ title: t('refunds.emptyTitle'), message: t('refunds.emptyMessage') }}
          columns={[
            {
              key: 'ref',
              header: t('common:column.reference'),
              sortValue: (r) => r.ref,
              filter: { kind: 'text', value: (r) => `${r.ref} ${r.bookingRef} ${r.reason}` },
              render: (r) => (
                <div>
                  <p className="font-mono text-xs font-semibold">{r.ref}</p>
                  <RefLink to={`/bookings/${r.bookingId}`}>{r.bookingRef}</RefLink>
                </div>
              ),
            },
            { key: 'customer', header: t('common:column.customer'), render: (r) => r.customerName || '—' },
            {
              key: 'activity',
              header: t('common:column.activity'),
              filter: { kind: 'select', options: visibleEngineOptions(), value: (r) => r.engineKind },
              render: (r) => <Badge tone="info">{engineLabel(r.engineKind)}</Badge>,
            },
            {
              key: 'amount',
              header: t('common:column.amount'),
              align: 'right',
              sortValue: (r) => r.amount,
              render: (r) => <span className="tabular-nums font-semibold">{money(r.amount)}</span>,
            },
            { key: 'reason', header: t('common:column.reason'), render: (r) => <span className="text-muted text-xs">{r.reason}</span> },
            { key: 'by', header: t('refunds.askedBy'), render: (r) => <span className="text-muted text-xs">{r.requestedByName}</span> },
            {
              key: 'when',
              header: t('common:column.when'),
              sortValue: (r) => new Date(r.createdAt).getTime(),
              render: (r) => <span className="text-muted text-xs tabular-nums">{formatDateTime(new Date(r.createdAt).getTime())}</span>,
            },
            {
              key: 'status',
              header: t('common:column.status'),
              render: (r) => (
                <div>
                  <Badge tone={TONE[r.status]}>{t(`refunds.status.${r.status}`)}</Badge>
                  {r.reviewedByName && <p className="text-[11px] text-muted mt-0.5">{r.reviewedByName}</p>}
                </div>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) =>
                data?.canApprove && r.status === 'PENDING' ? (
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      setReviewing(r)
                      setNote('')
                    }}
                    data-testid={`refund-review-${r._id}`}
                  >
                    {t('refunds.review')}
                  </Button>
                ) : null,
            },
          ]}
        />
      )}

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={t('refunds.reviewTitle', { ref: reviewing?.ref ?? '' })}
        subtitle={t('refunds.reviewBlurb')}
        testId="refund-review-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)}>{t('common:action.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => decide(false)}
              loading={review.isPending}
              disabled={note.trim().length === 0}
              data-testid="refund-reject"
            >
              <CircleX size={16} /> {t('refunds.refuse')}
            </Button>
            <Button onClick={() => decide(true)} loading={review.isPending} data-testid="refund-approve">
              <CircleCheck size={16} /> {t('refunds.release')}
            </Button>
          </>
        }
      >
        <p className="text-sm mb-1">
          <span className="font-semibold">{money(reviewing?.amount ?? 0)}</span> · {reviewing?.bookingRef}
        </p>
        <p className="text-sm text-muted mb-3">{reviewing?.reason}</p>
        <Field label={t('refunds.note')} hint={t('refunds.noteHint')}>
          <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="refund-note" />
        </Field>
      </Modal>
    </div>
  )
}
