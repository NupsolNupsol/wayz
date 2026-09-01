import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, PlayCircle, Lock } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, StatusBadge, SectionTitle, Field, StatCard, Spinner } from '@/components/ui'
import { useShift, useOpenShift, useBlindCount } from '@/hooks'
import { ApiError } from '@/api/client'
import { money, formatDateTime } from '@/utils'
import { toast } from '@/state/toastStore'

export function ShiftPage() {
  const { t } = useTranslation(['agent', 'common'])
  const { data: shift, isLoading } = useShift()
  const openMut = useOpenShift()
  const countMut = useBlindCount()
  const [counted, setCounted] = useState('')

  const close = () => {
    if (!shift) return
    countMut.mutate({ id: shift._id, countedCash: parseFloat(counted) || 0 }, {
      onSuccess: (s) => toast(s.status === 'CLOSED' ? 'success' : 'warning', s.status === 'CLOSED' ? 'Shift closed' : 'Variance detected', s.status === 'CLOSED' ? 'Blind count matched the ledger.' : `${money(s.variance ?? 0)} — supervisor resolution required.`),
      onError: (e) => toast('danger', 'Failed', e instanceof ApiError ? e.message : ''),
    })
  }

  return (
    <div data-testid="shift-page">
      <PageHeader helpId="shift" title={t('shift.title')} subtitle={t('shift.subtitle')} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.shift') }]} />
      {isLoading ? <Spinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            {!shift ? (
              <div className="text-center py-8">
                <Clock className="mx-auto text-muted mb-3" size={32} />
                <p className="text-muted mb-4">{t('shift.noOpenShift')}</p>
                <Button onClick={() => openMut.mutate()} loading={openMut.isPending} data-testid="shift-open"><PlayCircle size={16} />{t('shift.openShift')}</Button>
              </div>
            ) : shift.status === 'RECONCILING' ? (
              <div data-testid="shift-reconciling">
                <div className="flex items-center justify-between mb-3"><SectionTitle>{t('shift.reconciliationRequired')}</SectionTitle><StatusBadge status={shift.status} /></div>
                <div className="lf-card p-4 bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm">{t('shift.counted')}<strong>{money(shift.countedCash ?? 0)}</strong> vs expected <strong>{money(shift.expectedCash)}</strong>.</p>
                  <p className="text-sm mt-1">{t('shift.variance')}<strong className="text-danger-strong">{money(shift.variance ?? 0)}</strong></p>
                  <p className="text-xs text-muted mt-2">{t('shift.supervisorNote')}</p>
                </div>
              </div>
            ) : shift.status === 'CLOSED' ? (
              <div className="text-center py-8" data-testid="shift-closed"><StatusBadge status="CLOSED" /><p className="text-muted mt-3">Shift closed {formatDateTime(shift.closedAt ? new Date(shift.closedAt).getTime() : null)}.</p><Button className="mt-4" onClick={() => openMut.mutate()}>{t('shift.openNewShift')}</Button></div>
            ) : (
              <div data-testid="shift-open-state">
                <div className="flex items-center justify-between mb-4"><SectionTitle>{t('shift.blindCount')}</SectionTitle><StatusBadge status={shift.status} /></div>
                <p className="text-sm text-muted mb-4">{t('shift.blindCountHint')}</p>
                <Field label={t('cashier:shift.countedCash', { currency: t('common:money.currency') })} required><input type="number" step="0.01" className="lf-input" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" data-testid="shift-counted" /></Field>
                <Button onClick={close} loading={countMut.isPending} disabled={counted === ''} data-testid="shift-close"><Lock size={16} />{t('shift.closeShift')}</Button>
              </div>
            )}
          </Card>
          <div className="flex flex-col gap-4">
            <StatCard label={t('shift.opened')} value={formatDateTime(shift?.openedAt ? new Date(shift.openedAt).getTime() : null)} tone="neutral" />
            <StatCard label={t('shift.expectedLedger')} value={money(shift?.expectedCash ?? 0)} tone="success" />
          </div>
        </div>
      )}
    </div>
  )
}
