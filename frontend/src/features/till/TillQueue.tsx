import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, ClipboardCheck, Clock, Printer, TriangleAlert, User } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PaymentPanel, type PaymentSplit } from '@/components/PaymentPanel'
import { Icon } from '@/components/Icon'
import { useTillQueue, useTillOverview, useOpenShift, usePay } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { ENGINE_META } from '@/config/engineMeta'
import { money, waitedFor, STALE_QUEUE_MS } from './tillFormat'
import type { QueuedPayment } from '@/api/till.api'
import type { EngineKind } from '@/api/types'

function QueueCard({ row, onTake, stale }: { row: QueuedPayment; onTake: () => void; stale: boolean }) {
  const { t } = useTranslation('till')
  const engine = ENGINE_META[row.engineKind as EngineKind]
  return (
    <Card
      className={clsx('p-4 transition-shadow hover:shadow-pop', stale && 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10')}
      data-testid={`queue-card-${row.bookingId}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RefText className="text-muted">{row.ref}</RefText>
            {engine && (
              <Badge tone="neutral">
                <Icon name={engine.icon} size={12} className="me-1 inline" />
                {engine.label}
              </Badge>
            )}
            {stale && (
              <Badge tone="warning">
                <Clock size={11} className="me-1 inline" /> {t('queue.waitingFor', { duration: waitedFor(row.waitingMs) })}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-navy dark:text-dk-texthi mt-1.5 truncate flex items-center gap-1.5">
            <User size={14} className="text-muted shrink-0" />
            {row.customerName || 'Walk-in'}
          </p>
          <p className="text-sm text-muted truncate">{row.productName}</p>
          <p className="text-xs text-muted mt-0.5">
            {row.items > 0 ? t('queue.itemCount', { count: row.items }) : ''}
            {t('queue.registeredAgo', { duration: waitedFor(row.waitingMs) })}
          </p>
        </div>
        <div className="text-end shrink-0">
          <p className="text-xl font-bold tabular-nums text-navy dark:text-dk-texthi">{money(row.total)}</p>
          {row.depositTotal > 0 && <p className="text-[11px] text-muted">{t('queue.inclDeposit', { amount: money(row.depositTotal) })}</p>}
          <p className="text-[11px] text-muted">{t('queue.vat')} {money(row.vat)}</p>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button onClick={onTake} data-testid={`queue-take-${row.bookingId}`}>
          <Banknote size={16} />{t('queue.takePayment')}</Button>
      </div>
    </Card>
  )
}

export function TillQueue() {
  const { t } = useTranslation('till')
  const { data: rows, isLoading } = useTillQueue()
  const { data: overview } = useTillOverview()
  const pay = usePay()
  const openShift = useOpenShift()

  const [taking, setTaking] = useState<QueuedPayment | null>(null)

  const tillOpen = !!overview?.shift && overview.shift.status === 'OPEN'

  const confirm = (splits: PaymentSplit[]) => {
    if (!taking) return
    pay.mutate(
      { id: taking.bookingId, splits },
      {
        onSuccess: () => {
          toast('success', `${money(taking.total)} taken`, `${taking.ref} is paid — the agent can assign a compartment.`)
          setTaking(null)
        },
        onError: (e) =>
          toast('danger', t('queue.paymentNotTaken'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  if (isLoading || !rows) {
    return (
      <div data-testid="till-queue">
        <PageHeader title={t('queue.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const value = rows.reduce((t, r) => t + r.total, 0)
  const overdue = rows.filter((r) => r.waitingMs > STALE_QUEUE_MS).length

  return (
    <div data-testid="till-queue">
      <PageHeader
        title={t('queue.title')}
        subtitle={t('queue.subtitle')}
        crumbs={[{ label: t('common:crumb.till') }, { label: t('queue.crumb') }]}
        helpId="till-queue"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label={t('queue.inTheQueue')} value={rows.length} icon={<ClipboardCheck size={18} />} tone={rows.length ? 'warning' : 'neutral'} testId="queue-stat-count" />
        <StatCard label={t('queue.value')} value={money(value)} icon={<Banknote size={18} />} tone="info" testId="queue-stat-value" />
        <StatCard label={t('queue.waitingTooLong')} value={overdue} icon={<Clock size={18} />} tone={overdue ? 'danger' : 'neutral'} sublabel={t('queue.overMinutes', { count: STALE_QUEUE_MS / 60000 })} testId="queue-stat-overdue" />
      </div>

      {!tillOpen && (
        <Card className="mb-5 p-4 flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 dark:bg-amber-900/20" data-testid="queue-till-closed">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-sm text-navy dark:text-dk-text">
              Your till is {overview?.shift ? 'awaiting a supervisor' : 'closed'}. Card payments still work; cash will be
              refused until it is open.
            </p>
          </div>
          {!overview?.shift && (
            <Button
              onClick={() => openShift.mutate(undefined, { onSuccess: () => toast('success', t('queue.tillOpen')) })}
              loading={openShift.isPending}
              data-testid="queue-open-till"
            >{t('queue.openMyTill')}</Button>
          )}
        </Card>
      )}

      <SectionTitle className="mb-2">{t('queue.oldestFirst')}</SectionTitle>
      {rows.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<ClipboardCheck size={30} />}
            title={t('queue.empty')}
            message={t('queue.emptyMessage')}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3" data-testid="queue-list">
          {rows.map((row) => (
            <QueueCard key={row.bookingId} row={row} stale={row.waitingMs > STALE_QUEUE_MS} onTake={() => setTaking(row)} />
          ))}
        </div>
      )}

      <Modal
        open={!!taking}
        onClose={() => setTaking(null)}
        title={taking ? `Take ${money(taking.total)}` : 'Take payment'}
        subtitle={taking ? `${taking.ref} · ${taking.customerName || 'Walk-in'}` : undefined}
        size="lg"
        testId="queue-pay-modal"
      >
        {taking && (
          <>
            <div className="lf-card p-3 mb-4">
              <div className="flex items-baseline justify-between py-1">
                <span className="text-sm text-muted">{taking.productName}</span>
                <span className="tabular-nums">{money(taking.subtotal)}</span>
              </div>
              <div className="flex items-baseline justify-between py-1">
                <span className="text-sm text-muted">{t('queue.vat')}</span>
                <span className="tabular-nums">{money(taking.vat)}</span>
              </div>
              {taking.depositTotal > 0 && (
                <div className="flex items-baseline justify-between py-1">
                  <span className="text-sm text-muted">{t('queue.refundableDeposit')}</span>
                  <span className="tabular-nums">{money(taking.depositTotal)}</span>
                </div>
              )}
              <div className="border-t border-line dark:border-dk-border mt-1 pt-2 flex items-baseline justify-between">
                <span className="font-semibold text-navy dark:text-dk-texthi">{t('queue.total')}</span>
                <span className="text-lg font-bold tabular-nums text-navy dark:text-dk-texthi">{money(taking.total)}</span>
              </div>
            </div>

            <PaymentPanel total={taking.total} onConfirm={confirm} confirming={pay.isPending} />

            <p className="text-xs text-muted mt-3 flex items-start gap-1.5">
              <Printer size={13} className="mt-0.5 shrink-0" />
              A receipt is issued automatically. Paying confirms the booking — it does not start the storage timer, which
              begins only when the agent scans the bags into a compartment.
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
