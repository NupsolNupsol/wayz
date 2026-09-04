import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Banknote, ClipboardCheck, CreditCard, Clock, TriangleAlert, Wallet, ArrowRight, Undo2 } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { useTillOverview, useOpenShift, useShift } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money, waitedFor } from './tillFormat'

function DrawerLine({ label, value, sign, hint }: { label: string; value: number; sign?: '+' | '−'; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-navy dark:text-dk-text">{label}</p>
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
      </div>
      <p className={clsx('tabular-nums font-medium shrink-0', sign === '−' ? 'text-danger-strong' : 'text-navy dark:text-dk-texthi')}>
        {sign === '−' ? '−' : sign === '+' ? '+' : ''}
        {money(value)}
      </p>
    </div>
  )
}

export function TillPage() {
  const { t } = useTranslation('till')
  const navigate = useNavigate()
  const { data, isLoading } = useTillOverview()
  const { data: shift } = useShift()
  const openShift = useOpenShift()

  if (isLoading || !data) {
    return (
      <div data-testid="till-overview">
        <PageHeader title={t('till.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const d = data.drawer

  return (
    <div data-testid="till-overview">
      <PageHeader
        title={t('till.title')}
        subtitle={t('till.subtitle')}
        crumbs={[{ label: t('till.title') }]}
        helpId="till-overview"
        actions={
          <Button variant="secondary" onClick={() => navigate('/till/queue')} data-testid="till-go-queue">
            <ClipboardCheck size={16} />{t('till.awaitingPayment')}</Button>
        }
      />

      {!data.shift && (
        <Card className="mb-5 p-4 flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 dark:bg-amber-900/20" data-testid="till-closed">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-navy dark:text-dk-texthi">{t('till.closed')}</p>
              <p className="text-sm text-muted">{t('till.closedMessage')}</p>
            </div>
          </div>
          <Button
            onClick={() =>
              openShift.mutate(undefined, {
                onSuccess: () => toast('success', t('till.opened'), t('till.openedDetail')),
                onError: (e) => toast('danger', t('till.couldNotOpen'), e instanceof ApiError ? e.message : ''),
              })
            }
            loading={openShift.isPending}
            data-testid="till-open"
          >{t('till.openMyTill')}</Button>
        </Card>
      )}

      {data.shift?.status === 'RECONCILING' && (
        <Card className="mb-5 p-4 flex items-start gap-3 border-danger-strong/40 bg-red-50 dark:bg-red-900/20" data-testid="till-reconciling">
          <TriangleAlert size={18} className="text-danger-strong shrink-0 mt-0.5" />
          <p className="text-sm text-navy dark:text-dk-text">{t('till.reconciling')}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('till.expectedInDrawer')}
          value={money(data.shift?.expectedCash ?? 0)}
          icon={<Wallet size={18} />}
          tone={data.shift ? 'info' : 'neutral'}
          sublabel={data.shift ? `${waitedFor(Date.now() - new Date(data.shift.openedAt).getTime())}` : t('till.noTillOpen')}
          testId="till-stat-drawer"
        />
        <StatCard
          label={t('till.awaitingPayment')}
          value={data.queue.count}
          icon={<ClipboardCheck size={18} />}
          tone={data.queue.count ? 'warning' : 'neutral'}
          sublabel={data.queue.count ? `${money(data.queue.value)} · ${waitedFor(data.queue.oldestWaitingMs)}` : t('till.nothingWaiting')}
          onClick={() => navigate('/till/queue')}
          testId="till-stat-queue"
        />
        <StatCard
          label={t('till.takenToday')}
          value={money(data.today.net)}
          icon={<Banknote size={18} />}
          tone="success"
          sublabel={t('till.transactionCount', { count: data.today.transactions })}
          onClick={() => navigate('/till/transactions')}
          testId="till-stat-today"
        />
        <StatCard
          label={t('till.refundedToday')}
          value={money(data.today.refunded)}
          icon={<Undo2 size={18} />}
          tone={data.today.refunded > 0 ? 'warning' : 'neutral'}
          sublabel={t('till.paidBackOut')}
          testId="till-stat-refunds"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <section>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <Wallet size={16} />{t('till.cashDrawer')}</SectionTitle>
          <Card className="p-4" data-testid="till-drawer">
            {!d ? (
              <EmptyState icon={<Wallet size={26} />} title={t('till.noOpenTill')} message={t('till.openOneToTrack')} />
            ) : (
              <>
                <DrawerLine label={t('till.openingFloat')} value={d.floatIn} sign="+" hint={t('till.cashPutIn')} />
                <DrawerLine label={t('till.cashTaken')} value={d.cashSales} sign="+" hint={t('till.paymentsInCash')} />
                <DrawerLine label={t('till.cashRefunded')} value={d.cashRefunds} sign="−" hint={t('till.givenBack')} />
                <DrawerLine label={t('till.paidOut')} value={d.paidOut} sign="−" hint={t('till.expensesFromDrawer')} />
                <DrawerLine label={t('till.banked')} value={d.dropped} sign="−" hint={t('till.removedToSafe')} />

                <div className="border-t border-line dark:border-dk-border mt-2 pt-3 flex items-baseline justify-between">
                  <p className="font-semibold text-navy dark:text-dk-texthi">{t('till.shouldBeInDrawer')}</p>
                  <p className="text-xl font-bold tabular-nums text-navy dark:text-dk-texthi" data-testid="till-drawer-total">
                    {money(d.derived)}
                  </p>
                </div>

                {Math.abs(d.drift) > 0.009 && (
                  <p className="mt-2 text-xs text-danger-strong" data-testid="till-drift">
                    This does not match the running total ({money(d.expected)}). Report it — do not adjust your count.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => navigate('/till/drawer')} data-testid="till-go-drawer">
                    <Banknote size={16} />{t('till.movements')}</Button>
                  <Button variant="ghost" onClick={() => navigate('/till/shift')} data-testid="till-go-shift">
                    <Clock size={16} />{t('till.countAndClose')}</Button>
                </div>
              </>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <Banknote size={16} />{t('till.todayAtCounter')}</SectionTitle>
          <Card className="p-4" data-testid="till-today">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="lf-card p-3">
                <p className="text-xs text-muted flex items-center gap-1.5">
                  <Banknote size={13} /> {t('till.cash')}
                </p>
                <p className="text-lg font-bold tabular-nums text-navy dark:text-dk-texthi">{money(data.today.cash)}</p>
              </div>
              <div className="lf-card p-3">
                <p className="text-xs text-muted flex items-center gap-1.5">
                  <CreditCard size={13} /> {t('till.card')}
                </p>
                <p className="text-lg font-bold tabular-nums text-navy dark:text-dk-texthi">{money(data.today.card)}</p>
              </div>
            </div>

            <div className="flex items-baseline justify-between py-1.5">
              <p className="text-sm text-navy dark:text-dk-text">{t('till.gross')}</p>
              <p className="tabular-nums">{money(data.today.gross)}</p>
            </div>
            <div className="flex items-baseline justify-between py-1.5">
              <p className="text-sm text-navy dark:text-dk-text">{t('till.lessRefunds')}</p>
              <p className="tabular-nums text-danger-strong">−{money(data.today.refunded)}</p>
            </div>
            <div className="border-t border-line dark:border-dk-border mt-2 pt-3 flex items-baseline justify-between">
              <p className="font-semibold text-navy dark:text-dk-texthi">{t('till.net')}</p>
              <p className="text-xl font-bold tabular-nums text-navy dark:text-dk-texthi" data-testid="till-today-net">
                {money(data.today.net)}
              </p>
            </div>

            <Button variant="secondary" className="mt-4" onClick={() => navigate('/till/transactions')} data-testid="till-go-transactions">{t('till.everyTransaction')}<ArrowRight size={15} />
            </Button>
          </Card>

          {shift?.status === 'RECONCILING' && (
            <Badge tone="danger" className="mt-3">{t('till.awaitingSignOff')}</Badge>
          )}
        </section>
      </div>
    </div>
  )
}
