import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CreditCard } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './ui'
import { useShift } from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { money } from '@/utils'
import { CARD_SCHEMES, schemeLabel } from '@/config/cardSchemes'
import type { CardScheme, PaymentMethod } from '@/models'

export interface PaymentSplit {
  method: PaymentMethod
  cardScheme?: CardScheme | null
  amount: number
}

export function PaymentPanel({
  total,
  onConfirm,
  confirming,
  disabled,
}: {
  total: number
  onConfirm: (splits: PaymentSplit[]) => void
  confirming?: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation('ui')
  const [method, setMethod] = useState<PaymentMethod>('CARD')
  const [scheme, setScheme] = useState<CardScheme>('MADA')

  const role = useAuthStore((s) => s.me?.role)
  const needsTill = can(role, 'shift.blindCount')
  const { data: shift } = useShift(needsTill)
  const tillShut = needsTill && (!shift || shift.status !== 'OPEN')

  const missingScheme = method === 'CARD' && !scheme

  const confirm = () =>
    onConfirm([{ method, cardScheme: method === 'CARD' ? scheme : null, amount: total }])

  return (
    <div data-testid="payment-panel">
      {tillShut && (
        <p
          className="mb-3 rounded-xl2 border border-amber-400/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
          data-testid="pay-till-shut"
        >
          {t('payment.tillShut')}
        </p>
      )}
      <div className="flex rounded-xl2 border border-line dark:border-dk-line overflow-hidden">
        <button
          type="button"
          onClick={() => setMethod('CARD')}
          data-testid="pay-method-card-0"
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
            method === 'CARD' ? 'bg-brand text-white' : 'bg-white dark:bg-dk-elevated text-muted',
          )}
        >
          <CreditCard size={15} /> {t('payment.card')}
        </button>
        <button
          type="button"
          onClick={() => setMethod('CASH')}
          data-testid="pay-method-cash-0"
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
            method === 'CASH' ? 'bg-brand text-white' : 'bg-white dark:bg-dk-elevated text-muted',
          )}
        >
          <Banknote size={15} /> {t('payment.cash')}
        </button>
      </div>

      {method === 'CARD' && (
        <div className="mt-3" data-testid="pay-scheme-row-0">
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">{t('payment.whichCard')}</p>
          <div className="flex flex-wrap gap-1.5">
            {CARD_SCHEMES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScheme(s)}
                data-testid={`pay-scheme-${s}-0`}
                className={clsx(
                  'px-2.5 h-8 rounded-lg text-xs font-semibold border transition-colors',
                  scheme === s
                    ? 'bg-brand text-brand-fg border-brand'
                    : 'border-line dark:border-dk-border text-muted hover:text-brand hover:border-brand',
                )}
              >
                {schemeLabel(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 text-sm">
        <p className="text-muted">
          {t('payment.total')} <span className="font-semibold text-navy dark:text-dk-text" data-testid="pay-total">{money(total)}</span>
        </p>
        <Button
          onClick={confirm}
          loading={confirming}
          disabled={disabled || missingScheme || tillShut || total <= 0}
          data-testid="pay-confirm"
        >
          {t('payment.confirm')}
        </Button>
      </div>
      <p className="text-[11px] text-muted mt-2">{t('payment.noTimerNote')}</p>
    </div>
  )
}
