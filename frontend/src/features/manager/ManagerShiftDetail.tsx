import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, ScrollText, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Field, SectionTitle, Spinner, StatCard, StatusBadge } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { NumberInput } from '@/components/NumberInput'
import { useForceCloseShift, useManagerShift, useResolveShift, useTillDrawer, useTillTransactions } from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { formatDateTime, money } from '@/utils'

export function ManagerShiftDetail() {
  const { t } = useTranslation(['manager', 'agent', 'common'])
  const { id } = useParams<{ id: string }>()
  const role = useAuthStore((s) => s.me?.role)
  const mayAct = can(role, 'shift.reconcile')

  const { data: shift, isLoading } = useManagerShift(id)
  const { data: drawer } = useTillDrawer(id)
  const { data: takings = [] } = useTillTransactions({ shiftId: id })

  const resolveMut = useResolveShift()
  const forceMut = useForceCloseShift()
  const [resolveOpen, setResolveOpen] = useState(false)
  const [forceOpen, setForceOpen] = useState(false)
  const [note, setNote] = useState('')
  const [counted, setCounted] = useState(0)

  if (isLoading) return <Spinner />
  if (!shift) return null

  const fail = (e: unknown) => toast('danger', t('shifts.failed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')

  const resolve = () =>
    resolveMut.mutate(
      { id: shift._id, note: note.trim() },
      {
        onSuccess: () => { setResolveOpen(false); setNote(''); toast('success', t('shifts.resolved')) },
        onError: fail,
      },
    )

  const forceClose = () =>
    forceMut.mutate(
      { id: shift._id, countedCash: counted, reason: note.trim() },
      {
        onSuccess: (s) => {
          setForceOpen(false)
          setNote('')
          toast(s.variance ? 'warning' : 'success', t('shifts.forceClosed'), t('shifts.forceClosedDetail', { amount: money(s.variance ?? 0) }))
        },
        onError: fail,
      },
    )

  return (
    <div data-testid="mgr-shift-detail">
      <PageHeader
        title={t('shifts.detailTitle', { name: shift.agentName })}
        subtitle={`${shift.stationName}${shift.kioskName ? ` · ${shift.kioskName}` : ''}`}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.shifts'), to: '/manager/shifts' }, { label: shift.agentName }]}
        actions={
          mayAct ? (
            <>
              {shift.status === 'RECONCILING' && (
                <Button onClick={() => { setNote(''); setResolveOpen(true) }} data-testid="shift-resolve-open">
                  <ScrollText size={16} /> {t('shifts.resolve')}
                </Button>
              )}
              {shift.status !== 'CLOSED' && (
                <Button variant="secondary" onClick={() => { setNote(''); setCounted(shift.expectedCash); setForceOpen(true) }} data-testid="shift-force-open">
                  <Lock size={16} /> {t('shifts.forceClose')}
                </Button>
              )}
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t('common:column.status')} value={<StatusBadge status={shift.status} />} tone="neutral" testId="shift-detail-status" />
        <StatCard label={t('agent:shift.openingFloat')} value={money(shift.openingFloat ?? 0)} tone="neutral" testId="shift-detail-float" />
        <StatCard label={t('common:column.expected')} value={money(shift.expectedCash)} icon={<Wallet size={18} />} tone="info" testId="shift-detail-expected" />
        <StatCard
          label={t('common:column.variance')}
          value={shift.variance == null ? '—' : money(shift.variance)}
          tone={shift.variance ? 'danger' : 'success'}
          testId="shift-detail-variance"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-3">{t('shifts.takings')}</SectionTitle>
          <DataTable
            testId="shift-takings-table"
            rows={takings}
            keyOf={(r) => r._id}
            empty={{ title: t('shifts.noTakings'), message: t('shifts.noTakingsHint') }}
            columns={[
              { key: 'when', header: t('common:column.when'), sortValue: (r) => new Date(r.createdAt).getTime(), render: (r) => <span className="text-xs tabular-nums">{formatDateTime(new Date(r.createdAt).getTime())}</span> },
              { key: 'ref', header: t('common:column.reference'), render: (r) => <span className="font-mono text-xs">{r.bookingRef || r.orderId}</span> },
              { key: 'method', header: t('common:column.method'), render: (r) => `${r.method}${r.cardScheme ? ` · ${r.cardScheme}` : ''}` },
              { key: 'kind', header: t('common:column.kind'), render: (r) => <span className="text-muted text-xs">{r.kind}</span> },
              { key: 'amount', header: t('common:column.amount'), align: 'right', sortValue: (r) => r.amount, render: (r) => <span className="tabular-nums font-semibold">{money(r.amount)}</span> },
            ]}
          />
        </Card>

        <Card>
          <SectionTitle className="mb-3">{t('shifts.drawer')}</SectionTitle>
          {drawer?.drawer ? (
            <dl className="text-sm flex flex-col gap-2" data-testid="shift-drawer-breakdown">
              {([
                ['floatIn', drawer.drawer.floatIn],
                ['cashSales', drawer.drawer.cashSales],
                ['cashRefunds', -drawer.drawer.cashRefunds],
                ['paidOut', -drawer.drawer.paidOut],
                ['dropped', -drawer.drawer.dropped],
                ['expected', drawer.drawer.expected],
                ['drift', drawer.drawer.drift],
              ] as const).map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{t(`shifts.drawerLine.${key}`)}</dt>
                  <dd className="tabular-nums font-medium" data-testid={`shift-drawer-${key}`}>{money(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">{t('shifts.noDrawer')}</p>
          )}

          {shift.closedByName && (
            <p className="text-xs text-muted mt-4 pt-3 border-t border-line" data-testid="shift-closed-by">
              {t('shifts.closedBy', { name: shift.closedByName })}
              {shift.resolutionNote ? ` — ${shift.resolutionNote}` : ''}
            </p>
          )}
        </Card>
      </div>

      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title={t('shifts.resolveTitle')}
        subtitle={t('shifts.resolveBlurb', { amount: money(shift.variance ?? 0) })}
        testId="shift-resolve-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolveOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={resolve} loading={resolveMut.isPending} disabled={note.trim().length < 3} data-testid="shift-resolve-submit">
              {t('shifts.resolve')}
            </Button>
          </>
        }
      >
        <Field label={t('shifts.note')} required hint={t('shifts.noteHint')}>
          <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="shift-resolve-note" />
        </Field>
      </Modal>

      <Modal
        open={forceOpen}
        onClose={() => setForceOpen(false)}
        title={t('shifts.forceCloseTitle')}
        subtitle={t('shifts.forceCloseBlurb', { name: shift.agentName })}
        testId="shift-force-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForceOpen(false)}>{t('common:action.cancel')}</Button>
            <Button variant="danger" onClick={forceClose} loading={forceMut.isPending} disabled={note.trim().length < 3} data-testid="shift-force-submit">
              <Lock size={16} /> {t('shifts.forceClose')}
            </Button>
          </>
        }
      >
        <Field label={t('shifts.counted')} required hint={t('shifts.countedHint', { amount: money(shift.expectedCash) })}>
          <NumberInput value={counted} onChange={setCounted} min={0} step={10} testId="shift-force-counted" />
        </Field>
        <Field label={t('shifts.note')} required hint={t('shifts.forceNoteHint')}>
          <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="shift-force-note" />
        </Field>
      </Modal>
    </div>
  )
}
