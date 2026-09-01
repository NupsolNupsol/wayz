import { useState } from 'react'
import { formatTime } from '@/utils'
import { useTranslation } from 'react-i18next'
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Landmark, TriangleAlert, Wallet } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { useCashierDrawer, useOpenShift, useRecordMovement } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from './cashierFormat'
import type { CashMovement, CashMovementKind } from '@/api/cashier.api'

const KINDS: { value: CashMovementKind; icon: typeof Banknote; tone: 'success' | 'warning' | 'info' }[] = [
  { value: 'FLOAT_IN', icon: ArrowDownToLine, tone: 'success' },
  { value: 'PAY_OUT', icon: ArrowUpFromLine, tone: 'warning' },
  { value: 'DROP', icon: Landmark, tone: 'info' },
]

const kindMeta = (k: CashMovementKind) => KINDS.find((x) => x.value === k) ?? KINDS[0]

export function CashierDrawer() {
  const { t } = useTranslation(['cashier', 'common'])
  const { data, isLoading } = useCashierDrawer()
  const record = useRecordMovement()
  const openShift = useOpenShift()

  const [kind, setKind] = useState<CashMovementKind | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')

  const close = () => { setKind(null); setAmount(''); setReason(''); setReference('') }

  const submit = () => {
    if (!kind) return
    record.mutate(
      { kind, amount: Number(amount || 0), reason: reason.trim(), reference: reference.trim() || undefined },
      {
        onSuccess: () => {
          toast('success', t('drawer.recorded', { kind: t(`drawer.kind.${kind}`) }), t('drawer.recordedDetail', { amount: money(Number(amount || 0)) }))
          close()
        },
        onError: (e) => toast('danger', t('drawer.notRecorded'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  if (isLoading) {
    return (
      <div data-testid="cashier-drawer">
        <PageHeader title={t('drawer.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const d = data?.drawer ?? null
  const movements = data?.movements ?? []

  return (
    <div data-testid="cashier-drawer">
      <PageHeader
        title={t('drawer.title')}
        subtitle={t('drawer.subtitle')}
        crumbs={[{ label: t('common:crumb.cashier') }, { label: t('drawer.cashDrawer') }]}
        helpId="cashier-drawer"
        actions={
          d ? (
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Button key={k.value} variant={k.value === 'FLOAT_IN' ? 'primary' : 'secondary'} onClick={() => setKind(k.value)} data-testid={`drawer-add-${k.value}`}>
                  <k.icon size={16} /> {t(`drawer.kind.${k.value}`)}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      />

      {!d ? (
        <Card className="p-8">
          <EmptyState
            icon={<Wallet size={30} />}
            title={t('drawer.noTillOpen')}
            message={t('drawer.openToRecord')}
            action={
              <Button onClick={() => openShift.mutate(undefined, { onSuccess: () => toast('success', t('drawer.tillOpen')) })} loading={openShift.isPending} data-testid="drawer-open-till">{t('drawer.openMyTill')}</Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <StatCard label={t('drawer.shouldBeInDrawer')} value={money(d.derived)} icon={<Wallet size={18} />} tone="info" testId="drawer-stat-total" />
            <StatCard label={t('drawer.floatIn')} value={money(d.floatIn)} icon={<ArrowDownToLine size={18} />} tone="success" testId="drawer-stat-float" />
            <StatCard label={t('drawer.kind.PAY_OUT')} value={money(d.paidOut)} icon={<ArrowUpFromLine size={18} />} tone={d.paidOut ? 'warning' : 'neutral'} testId="drawer-stat-paidout" />
            <StatCard label={t('drawer.kind.DROP')} value={money(d.dropped)} icon={<Landmark size={18} />} tone="neutral" testId="drawer-stat-dropped" />
          </div>

          {Math.abs(d.drift) > 0.009 && (
            <Card className="mb-5 p-4 flex items-start gap-3 border-danger-strong/40 bg-red-50 dark:bg-red-900/20" data-testid="drawer-drift">
              <TriangleAlert size={18} className="text-danger-strong shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-danger-strong">{t('drawer.disagree')}</p>
                <p className="text-sm text-muted">
                  The movements add up to {money(d.derived)} but the till has been accumulating {money(d.expected)}.
                  Report this — it is a system problem, not a counting one, so do not adjust your count to match.
                </p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <Card className="p-4" data-testid="drawer-summary">
              <SectionTitle className="mb-3">{t('drawer.howThatAddsUp')}</SectionTitle>
              {[
                { label: t('drawer.openingFloat'), value: d.floatIn, sign: '+' as const },
                { label: t('drawer.cashTaken'), value: d.cashSales, sign: '+' as const },
                { label: t('drawer.cashRefunded'), value: d.cashRefunds, sign: '−' as const },
                { label: t('drawer.kind.PAY_OUT'), value: d.paidOut, sign: '−' as const },
                { label: t('drawer.kind.DROP'), value: d.dropped, sign: '−' as const },
              ].map((l) => (
                <div key={l.label} className="flex items-baseline justify-between py-1.5">
                  <span className="text-sm text-navy dark:text-dk-text">{l.label}</span>
                  <span className={clsx('tabular-nums', l.sign === '−' && 'text-danger-strong')}>
                    {l.sign}
                    {money(l.value)}
                  </span>
                </div>
              ))}
              <div className="border-t border-line dark:border-dk-border mt-2 pt-3 flex items-baseline justify-between">
                <span className="font-semibold text-navy dark:text-dk-texthi">{t('drawer.expected')}</span>
                <span className="text-xl font-bold tabular-nums text-navy dark:text-dk-texthi">{money(d.derived)}</span>
              </div>
              <p className="text-[11px] text-muted mt-3">
                {t('drawer.cardNote', { amount: money(d.cardSales) })}
              </p>
            </Card>

            <div className="lg:col-span-2">
              <SectionTitle className="mb-2">{t('drawer.movementsOnTill')}</SectionTitle>
              <DataTable
                testId="drawer-movements-table"
                rows={movements}
                keyOf={(r: CashMovement) => r._id}
                initialSort={{ key: 'when', dir: 'desc' }}
                pageSize={8}
                empty={{ title: t('drawer.noMovements'), message: t('drawer.noMovementsHint') }}
                columns={[
                  {
                    key: 'kind',
                    header: t('common:column.movement'),
                    filter: { kind: 'select', options: KINDS.map((k) => ({ label: t(`drawer.kind.${k.value}`), value: k.value })), value: (r: CashMovement) => r.kind },
                    sortValue: (r: CashMovement) => r.kind,
                    render: (r: CashMovement) => {
                      const m = kindMeta(r.kind)
                      return (
                        <Badge tone={m.tone}>
                          <m.icon size={12} className="me-1 inline" />
                          {t(`drawer.kind.${m.value}`)}
                        </Badge>
                      )
                    },
                  },
                  {
                    key: 'amount',
                    header: t('common:column.amount'),
                    align: 'right',
                    sortValue: (r: CashMovement) => r.amount,
                    render: (r: CashMovement) => (
                      <strong className={clsx('tabular-nums', r.kind === 'FLOAT_IN' ? 'text-success' : 'text-danger-strong')}>
                        {r.kind === 'FLOAT_IN' ? '+' : '−'}
                        {money(r.amount)}
                      </strong>
                    ),
                  },
                  {
                    key: 'reason',
                    header: t('common:column.reason'),
                    filter: { kind: 'text', value: (r: CashMovement) => `${r.reason} ${r.reference}` },
                    render: (r: CashMovement) => (
                      <div className="max-w-[260px]">
                        <p className="text-sm">{r.reason}</p>
                        {r.reference && <RefText className="text-muted">{r.reference}</RefText>}
                      </div>
                    ),
                  },
                  { key: 'by', header: t('common:column.by'), render: (r: CashMovement) => <span className="text-sm">{r.actorName}</span> },
                  {
                    key: 'when',
                    header: t('common:column.recorded'),
                    align: 'right',
                    sortValue: (r: CashMovement) => r.createdAt,
                    render: (r: CashMovement) => (
                      <span className="text-xs text-muted tabular-nums">
                        {formatTime(new Date(r.createdAt).getTime())}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </>
      )}

      <Modal
        open={!!kind}
        onClose={close}
        title={kind ? t(`drawer.kind.${kind}`) : ''}
        subtitle={kind ? t(`drawer.blurb.${kind}`) : undefined}
        testId="drawer-modal"
        footer={
          <>
            <Button variant="ghost" onClick={close}>{t('common:action.cancel')}</Button>
            <Button
              onClick={submit}
              loading={record.isPending}
              disabled={!(Number(amount) > 0) || reason.trim().length < 3}
              data-testid="drawer-submit"
            >
              Record {money(Number(amount || 0))}
            </Button>
          </>
        }
      >
        <Field label={t('common:field.amount')} required>
          <input
            type="number"
            min={0}
            step="0.01"
            className="lf-input tabular-nums text-lg"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            data-testid="drawer-amount"
          />
        </Field>

        <Field label={t('common:field.reason')} required hint={t('drawer.movementHint')}>
          <textarea
            className="lf-input min-h-[80px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={kind ? t(`drawer.placeholder.${kind}`) : ''}
            data-testid="drawer-reason"
          />
        </Field>

        <Field label={t('common:field.reference')} hint={t('drawer.referenceHint')}>
          <input className="lf-input" value={reference} onChange={(e) => setReference(e.target.value)} data-testid="drawer-reference" />
        </Field>

        {kind !== 'FLOAT_IN' && d && (
          <p className="text-xs text-muted">
            The drawer is expected to hold {money(d.derived)}. You cannot take out more than that.
          </p>
        )}
      </Modal>
    </div>
  )
}
