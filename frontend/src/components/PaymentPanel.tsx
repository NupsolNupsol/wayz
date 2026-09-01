import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Banknote, CreditCard } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './ui'
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
  const [splits, setSplits] = useState<PaymentSplit[]>([{ method: 'CASH', amount: total }])
  const paid = splits.reduce((s, x) => s + (x.amount || 0), 0)
  const remaining = +(total - paid).toFixed(2)

  const update = (i: number, patch: Partial<PaymentSplit>) =>
    setSplits((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const add = () => setSplits((s) => [...s, { method: 'CARD', cardScheme: 'MADA', amount: Math.max(0, remaining) }])
  const remove = (i: number) => setSplits((s) => s.filter((_, idx) => idx !== i))

  const missingScheme = splits.some((s) => s.amount > 0 && s.method === 'CARD' && !s.cardScheme)

  return (
    <div data-testid="payment-panel">
      <div className="flex flex-col gap-3">
        {splits.map((s, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl2 border border-line overflow-hidden">
                <button
                  type="button"
                  onClick={() => update(i, { method: 'CASH', cardScheme: null })}
                  data-testid={`pay-method-cash-${i}`}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium ${s.method === 'CASH' ? 'bg-brand text-white' : 'bg-white dark:bg-dk-elevated text-muted'}`}
                >
                  <Banknote size={15} /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => update(i, { method: 'CARD', cardScheme: s.cardScheme ?? 'MADA' })}
                  data-testid={`pay-method-card-${i}`}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium ${s.method === 'CARD' ? 'bg-brand text-white' : 'bg-white dark:bg-dk-elevated text-muted'}`}
                >
                  <CreditCard size={15} /> Card
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                value={s.amount}
                onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
                className="lf-input flex-1"
                data-testid={`pay-amount-${i}`}
              />
              {splits.length > 1 && (
                <button onClick={() => remove(i)} className="p-2 text-danger-strong hover:bg-red-50 rounded-lg" aria-label={t('payment.remove')}><Trash2 size={16} /></button>
              )}
            </div>

            {s.method === 'CARD' && (
              <div data-testid={`pay-scheme-row-${i}`}>
                <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">{t('payment.whichCard')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {CARD_SCHEMES.map((scheme) => (
                    <button
                      key={scheme}
                      type="button"
                      onClick={() => update(i, { cardScheme: scheme })}
                      data-testid={`pay-scheme-${scheme}-${i}`}
                      className={clsx(
                        'px-2.5 h-8 rounded-lg text-xs font-semibold border transition-colors',
                        s.cardScheme === scheme
                          ? 'bg-brand text-brand-fg border-brand'
                          : 'border-line dark:border-dk-border text-muted hover:text-brand hover:border-brand',
                      )}
                    >
                      {schemeLabel(scheme)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={add} className="mt-2 text-sm text-brand font-medium flex items-center gap-1.5" data-testid="pay-add">
        <Plus size={15} />{t('payment.split')}</button>

      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-sm">
        <div>
          <p className="text-muted">Total <span className="font-semibold text-navy dark:text-dk-text">{money(total)}</span></p>
          <p className={remaining === 0 ? 'text-success' : 'text-amber-600'} data-testid="pay-remaining">
            Remaining {money(Math.max(0, remaining))}
          </p>
          {missingScheme && (
            <p className="text-amber-600 mt-0.5" data-testid="pay-scheme-missing">{t('payment.pickCard')}</p>
          )}
        </div>
        <Button
          onClick={() => onConfirm(splits.filter((s) => s.amount > 0))}
          loading={confirming}
          disabled={disabled || missingScheme || Math.abs(remaining) > 0.001}
          data-testid="pay-confirm"
        >{t('payment.confirm')}</Button>
      </div>
      <p className="text-[11px] text-muted mt-2">Payment records the sale and confirms the booking — it does <strong>not</strong> start any operational timer.</p>
    </div>
  )
}
