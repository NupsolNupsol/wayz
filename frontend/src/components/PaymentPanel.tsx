import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CreditCard } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './ui'
import { useShift } from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { money, round2 } from '@/utils'
import { CARD_SCHEMES, schemeLabel } from '@/config/cardSchemes'
import type { CardScheme, PaymentMethod } from '@/models'
import { NumberInput } from './NumberInput'
import { SecondPayerModal, type SecondPayer } from './SecondPayerModal'

export interface PaymentSplit {
  method: PaymentMethod
  cardScheme?: CardScheme | null
  amount: number
  /** Set on the second half when somebody other than the booking's customer is paying it. */
  payerId?: string
}

export function PaymentPanel({
  total,
  discountOff = 0,
  onConfirm,
  confirming,
  disabled,
}: {
  total: number
  /** What a discount or a code took off, so the desk can say it out loud to the customer. */
  discountOff?: number
  onConfirm: (splits: PaymentSplit[]) => void
  confirming?: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation(['ui', 'common'])
  const [method, setMethod] = useState<PaymentMethod>('CARD')
  const [scheme, setScheme] = useState<CardScheme>('MADA')

  const role = useAuthStore((s) => s.me?.role)
  const needsTill = can(role, 'shift.blindCount')
  const { data: shift } = useShift(needsTill)
  const tillShut = needsTill && (!shift || shift.status !== 'OPEN')

  const missingScheme = method === 'CARD' && !scheme

  const [split, setSplit] = useState(false)
  const [firstAmount, setFirstAmount] = useState(total)
  const [secondMethod, setSecondMethod] = useState<PaymentMethod>('CASH')
  const [secondScheme, setSecondScheme] = useState<CardScheme>('MADA')

  /**
   * Who is covering the other half.
   *
   * Ticking the box asks for them straight away: a split is a second person paying, so there is
   * nothing to configure until we know who they are and they have been confirmed.
   */
  const [payerOpen, setPayerOpen] = useState(false)
  const [payer, setPayer] = useState<SecondPayer | null>(null)

  useEffect(() => setFirstAmount(total), [total])

  const openSplit = (on: boolean) => {
    setSplit(on)
    if (on) setPayerOpen(true)
    else setPayer(null)
  }

  const takeSecondPayer = (next: SecondPayer) => {
    setPayer(next)
    setPayerOpen(false)
    // Their share decides what is left for the customer on the booking.
    setFirstAmount(round2(total - next.amount))
  }

  const cancelSplit = () => {
    setPayerOpen(false)
    if (!payer) setSplit(false)
  }

  const firstPart = Math.min(Math.max(0, round2(firstAmount)), round2(total))
  const secondPart = round2(total - firstPart)
  const splitCoversEverything = split && secondPart <= 0
  const splitTakesNothing = split && firstPart <= 0
  const splitReady =
    !split || (!!payer && firstPart > 0 && secondPart > 0 && (secondMethod !== 'CARD' || !!secondScheme))

  /** A blocked Confirm always says why — a greyed button with no reason is a stuck agent. */
  const blockedBecause = tillShut
    ? t('payment.tillShut')
    : missingScheme
      ? t('payment.pickScheme')
      : splitCoversEverything
        ? t('payment.splitTooBig')
        : splitTakesNothing
          ? t('payment.splitTooSmall')
          : split && !payer
            ? t('payment.splitNeedsPayer')
            : split && secondMethod === 'CARD' && !secondScheme
              ? t('payment.pickScheme')
              : ''

  const confirm = () => {
    if (!split) {
      onConfirm([{ method, cardScheme: method === 'CARD' ? scheme : null, amount: total }])
      return
    }
    onConfirm([
      { method, cardScheme: method === 'CARD' ? scheme : null, amount: firstPart },
      {
        method: secondMethod,
        cardScheme: secondMethod === 'CARD' ? secondScheme : null,
        amount: secondPart,
        payerId: payer?.customer._id,
      },
    ])
  }

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

      <div className="mt-3">
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input type="checkbox" checked={split} onChange={(e) => openSplit(e.target.checked)} data-testid="pay-split-toggle" />
          {t('payment.splitIt')}
        </label>
      </div>

      {split && payer && (
        <div
          className="mt-3 rounded-xl2 border border-brand/40 bg-brand/5 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
          data-testid="pay-split-payer"
        >
          <span className="text-sm">
            <strong className="text-navy dark:text-dk-texthi">{payer.customer.name}</strong>{' '}
            <span className="text-muted">{t('payment.paysShare', { amount: money(secondPart) })}</span>
          </span>
          <button
            type="button"
            className="text-xs font-semibold text-brand-ink"
            onClick={() => setPayerOpen(true)}
            data-testid="pay-split-change-payer"
          >
            {t('common:action.change')}
          </button>
        </div>
      )}

      {split && payer && (
        <div className="mt-3 rounded-xl2 border border-line dark:border-dk-border p-3" data-testid="pay-split">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1">{t('payment.firstPart')}</p>
              <NumberInput
                min={0}
                max={total}
                step={0.01}
                value={firstAmount}
                onChange={setFirstAmount}
                testId="pay-split-amount"
              />
            </div>
            <div className="min-w-[160px]">
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1">
                {t('payment.restOn', { amount: money(secondPart) })}
              </p>
              <div className="flex gap-1.5">
                {(['CASH', 'CARD'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSecondMethod(m)}
                    data-testid={`pay-split-method-${m.toLowerCase()}`}
                    className={clsx(
                      'lf-btn !h-9 !px-3 text-xs border',
                      secondMethod === m ? 'bg-brand text-brand-fg border-brand' : 'bg-surface border-line text-muted',
                    )}
                  >
                    {m === 'CASH' ? t('payment.cash') : t('payment.card')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {secondMethod === 'CARD' && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {CARD_SCHEMES.map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setSecondScheme(sc)}
                  data-testid={`pay-split-scheme-${sc}`}
                  className={clsx(
                    'rounded-lg border px-2.5 py-1 text-xs font-medium',
                    secondScheme === sc ? 'bg-brand text-brand-fg border-brand' : 'border-line text-muted',
                  )}
                >
                  {schemeLabel(sc)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {blockedBecause && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300" data-testid="pay-blocked-reason">
          {blockedBecause}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 text-sm">
        <p className="text-muted">
          {t('payment.total')}{' '}
          {discountOff > 0 && (
            <span className="text-muted line-through tabular-nums me-1.5" data-testid="pay-total-before">
              {money(total + discountOff)}
            </span>
          )}
          <span className="font-semibold text-navy dark:text-dk-text" data-testid="pay-total">{money(total)}</span>
          {discountOff > 0 && (
            <span className="ms-2 text-xs font-medium text-success" data-testid="pay-discount-off">
              {t('payment.youSaved', { amount: money(discountOff) })}
            </span>
          )}
        </p>
        <Button
          onClick={confirm}
          loading={confirming}
          disabled={disabled || missingScheme || tillShut || total <= 0 || !splitReady}
          title={blockedBecause || undefined}
          data-testid="pay-confirm"
        >
          {t('payment.confirm')}
        </Button>
      </div>
      <p className="text-[11px] text-muted mt-2">{t('payment.noTimerNote')}</p>

      <SecondPayerModal open={payerOpen} total={total} onClose={cancelSplit} onConfirm={takeSecondPayer} />
    </div>
  )
}
