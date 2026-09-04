import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleX, FilePlus2, ReceiptText } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Field, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { useManualSales, useRecordManualSale, useReviewManualSale } from '@/hooks'
import { engineLabel, visibleEngineOptions } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { formatDateTime } from '@/utils'
import { toast } from '@/state/toastStore'
import type { EngineKind, PaymentMethod } from '@/api/types'
import type { ManualSale, ManualSaleStatus } from '@/api/manualSale.api'

const STATUS_TONE: Record<ManualSaleStatus, 'info' | 'success' | 'danger'> = {
  PENDING: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const today = () => new Date().toISOString().slice(0, 10)

export function ManualSalesPage() {
  const { t } = useTranslation(['accounting', 'common'])
  const [status, setStatus] = useState<ManualSaleStatus | ''>('')
  const { data, isLoading } = useManualSales(status ? { status } : undefined)
  const record = useRecordManualSale()
  const review = useReviewManualSale()

  const [creating, setCreating] = useState(false)
  const [reviewing, setReviewing] = useState<ManualSale | null>(null)
  const [note, setNote] = useState('')
  const [form, setForm] = useState({
    stationId: '',
    engineKind: 'MOBILITY' as EngineKind,
    description: '',
    amount: 0,
    method: 'CASH' as PaymentMethod,
    occurredAt: today(),
  })

  const stations = (data?.stations ?? []).map((st) => ({ label: st.name, value: st._id }))

  useEffect(() => {
    if (form.stationId || stations.length === 0) return
    setForm((prev) => ({ ...prev, stationId: stations[0].value }))
  }, [form.stationId, stations])

  const rows = data?.rows ?? []
  const fail = (e: unknown) =>
    toast('danger', t('common:error.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')

  const submit = () => {
    record.mutate(form, {
      onSuccess: (sale) => {
        setCreating(false)
        setForm((prev) => ({ ...prev, description: '', amount: 0 }))
        toast('success', t('manualSales.recorded'), t('manualSales.recordedDetail', { ref: sale.ref }))
      },
      onError: fail,
    })
  }

  const decide = (approve: boolean) => {
    if (!reviewing) return
    review.mutate(
      { id: reviewing._id, approve, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast(approve ? 'success' : 'warning', approve ? t('manualSales.approved') : t('manualSales.rejected'))
          setReviewing(null)
          setNote('')
        },
        onError: fail,
      },
    )
  }

  return (
    <div data-testid="manual-sales">
      <PageHeader
        title={t('manualSales.title')}
        subtitle={t('manualSales.subtitle')}
        crumbs={[{ label: t('manualSales.title') }]}
        actions={
          <Button onClick={() => setCreating(true)} disabled={stations.length === 0} data-testid="manual-sales-add">
            <FilePlus2 size={16} />
            {t('manualSales.record')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard
          label={t('manualSales.awaitingApproval')}
          value={rows.filter((r) => r.status === 'PENDING').length}
          icon={<ReceiptText size={18} />}
          tone="info"
          testId="manual-sales-pending-count"
        />
        <StatCard
          label={t('manualSales.pendingValue')}
          value={`${data?.pendingTotal ?? 0} ${t('common:money.currency')}`}
          tone="warning"
          testId="manual-sales-pending-total"
        />
        <div className="flex items-end">
          <Field label={t('common:column.status')} className="w-full mb-0">
            <Select
              value={status}
              onChange={(v) => setStatus(v as ManualSaleStatus | '')}
              options={[
                { label: t('common:table.all'), value: '' },
                { label: t('manualSales.status.PENDING'), value: 'PENDING' },
                { label: t('manualSales.status.APPROVED'), value: 'APPROVED' },
                { label: t('manualSales.status.REJECTED'), value: 'REJECTED' },
              ]}
              testId="manual-sales-status-filter"
            />
          </Field>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <DataTable
          testId="manual-sales-table"
          rows={rows}
          keyOf={(r) => r._id}
          empty={{ title: t('manualSales.emptyTitle'), message: t('manualSales.emptyMessage') }}
          columns={[
            {
              key: 'ref',
              header: t('common:column.reference'),
              sortValue: (r) => r.ref,
              filter: { kind: 'text', value: (r) => `${r.ref} ${r.description}` },
              render: (r) => (
                <div>
                  <p className="font-semibold text-navy dark:text-dk-texthi font-mono text-xs">{r.ref}</p>
                  <p className="text-xs text-muted">{r.description}</p>
                </div>
              ),
            },
            {
              key: 'activity',
              header: t('common:column.activity'),
              filter: { kind: 'select', options: visibleEngineOptions(), value: (r) => r.engineKind },
              render: (r) => <Badge tone="info">{engineLabel(r.engineKind)}</Badge>,
            },
            { key: 'station', header: t('common:column.station'), render: (r) => <span className="text-muted">{r.stationName}</span> },
            {
              key: 'occurred',
              header: t('manualSales.occurredAt'),
              sortValue: (r) => r.occurredAt,
              render: (r) => <span className="text-muted text-xs tabular-nums">{formatDateTime(new Date(r.occurredAt).getTime())}</span>,
            },
            {
              key: 'amount',
              header: t('common:column.amount'),
              align: 'right',
              sortValue: (r) => r.amount,
              render: (r) => <span className="tabular-nums font-semibold">{r.amount}</span>,
            },
            {
              key: 'method',
              header: t('common:column.method'),
              render: (r) => <Badge tone="neutral">{t(`common:method.${r.method}`)}</Badge>,
            },
            {
              key: 'status',
              header: t('common:column.status'),
              filter: {
                kind: 'select',
                options: (['PENDING', 'APPROVED', 'REJECTED'] as ManualSaleStatus[]).map((value) => ({
                  label: t(`manualSales.status.${value}`),
                  value,
                })),
                value: (r) => r.status,
              },
              render: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`manualSales.status.${r.status}`)}</Badge>,
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
                    data-testid={`manual-sales-review-${r._id}`}
                  >
                    {t('manualSales.review')}
                  </Button>
                ) : null,
            },
          ]}
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t('manualSales.record')}
        subtitle={t('manualSales.recordBlurb')}
        testId="manual-sales-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common:action.cancel')}</Button>
            <Button
              onClick={submit}
              loading={record.isPending}
              disabled={!form.stationId || form.description.trim().length < 3 || form.amount <= 0}
              data-testid="manual-sales-submit"
            >
              {t('manualSales.record')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('common:field.station')} required>
            <Select
              value={form.stationId}
              onChange={(v) => setForm({ ...form, stationId: v })}
              options={stations}
              searchable
              testId="manual-sales-station"
            />
          </Field>
          <Field label={t('common:column.activity')} required>
            <Select
              value={form.engineKind}
              onChange={(v) => setForm({ ...form, engineKind: v as EngineKind })}
              options={visibleEngineOptions()}
              testId="manual-sales-activity"
            />
          </Field>
        </div>
        <Field label={t('manualSales.description')} required hint={t('manualSales.descriptionHint')}>
          <input
            className="lf-input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            data-testid="manual-sales-description"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <Field label={t('common:column.amount')} required hint={t('manualSales.amountHint')}>
            <NumberInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} min={0} testId="manual-sales-amount" />
          </Field>
          <Field label={t('common:column.method')} required>
            <Select
              value={form.method}
              onChange={(v) => setForm({ ...form, method: v as PaymentMethod })}
              options={[
                { label: t('common:method.CASH'), value: 'CASH' },
                { label: t('common:method.CARD'), value: 'CARD' },
              ]}
              testId="manual-sales-method"
            />
          </Field>
          <Field label={t('manualSales.occurredAt')} required hint={t('manualSales.occurredHint')}>
            <input
              type="date"
              className="lf-input"
              max={today()}
              value={form.occurredAt}
              onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
              data-testid="manual-sales-date"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={t('manualSales.reviewTitle', { ref: reviewing?.ref ?? '' })}
        subtitle={t('manualSales.reviewBlurb')}
        testId="manual-sales-review-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)}>{t('common:action.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => decide(false)}
              loading={review.isPending}
              disabled={note.trim().length === 0}
              data-testid="manual-sales-reject"
            >
              <CircleX size={16} />
              {t('manualSales.reject')}
            </Button>
            <Button onClick={() => decide(true)} loading={review.isPending} data-testid="manual-sales-approve">
              <CircleCheck size={16} />
              {t('manualSales.approve')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted mb-3">
          {reviewing?.description} · {reviewing?.amount} {t('common:money.currency')}
        </p>
        <Field label={t('manualSales.note')} hint={t('manualSales.noteHint')}>
          <input
            className="lf-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="manual-sales-note"
          />
        </Field>
      </Modal>
    </div>
  )
}
