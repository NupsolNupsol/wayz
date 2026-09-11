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


/**
 * A party's second way of paying their own share.
 *
 * Rendered under whoever it belongs to, because that is the only thing it concerns: the customer
 * settling half on a card says nothing about how the person with them settles theirs. The amount
 * is what this method takes; the rest of the share stays on the method picked above it.
 */
function AlsoPayWith({
  on,
  setOn,
  share,
  amount,
  setAmount,
  method,
  setMethod,
  scheme,
  setScheme,
  testId,
}: {
  on: boolean
  setOn: (v: boolean) => void
  share: number
  amount: number
  setAmount: (v: number) => void
  method: PaymentMethod
  setMethod: (v: PaymentMethod) => void
  scheme: CardScheme
  setScheme: (v: CardScheme) => void
  testId: string
}) {
  const { t } = useTranslation(['ui', 'common'])
  return (
    <div className="mt-2">
      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked)
            // Half by default: the commonest thing an agent is asked for, and always inside range.
            if (e.target.checked && amount <= 0) setAmount(round2(share / 2))
          }}
          data-testid={`${testId}-toggle`}
        />
        {t('payment.alsoPayWith')}
      </label>

      {on && (
        <div className="mt-2 flex flex-wrap items-end gap-3" data-testid={testId}>
          <div className="min-w-[130px]">
            <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1">
              {t('payment.thisMethodTakes')}
            </p>
            <NumberInput min={0} max={share} step={0.01} value={amount} onChange={setAmount} testId={`${testId}-amount`} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1">{t('payment.onWhat')}</p>
            <div className="flex gap-1.5">
              {(['CASH', 'CARD'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  data-testid={`${testId}-method-${m.toLowerCase()}`}
                  className={clsx(
                    'lf-btn !h-9 !px-3 text-xs border',
                    method === m ? 'bg-brand text-brand-fg border-brand' : 'bg-surface border-line text-muted',
                  )}
                >
                  {m === 'CASH' ? t('payment.cash') : t('payment.card')}
                </button>
              ))}
            </div>
          </div>
          {method === 'CARD' && (
            <div className="flex flex-wrap gap-1.5">
              {CARD_SCHEMES.map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setScheme(sc)}
                  data-testid={`${testId}-scheme-${sc}`}
                  className={clsx(
                    'rounded-lg border px-2.5 py-1 text-xs font-medium',
                    scheme === sc ? 'bg-brand text-brand-fg border-brand' : 'border-line text-muted',
                  )}
                >
                  {schemeLabel(sc)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
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

  /*
   * Two different questions, and they were being confused with each other.
   *
   * *Who* pays is one: a booking can be shared between the customer and somebody with them, and
   * each owes a share. *How* each of them pays is another, and it is theirs alone — one settles a
   * share half on a card and half in cash, and what the other does about their own share has
   * nothing to do with it.
   *
   * So each party gets an optional second method of their own, with its own amount. The rest of
   * their share goes on the method they picked first.
   */
  const [firstAlso, setFirstAlso] = useState(false)
  const [firstAlsoMethod, setFirstAlsoMethod] = useState<PaymentMethod>('CASH')
  const [firstAlsoScheme, setFirstAlsoScheme] = useState<CardScheme>('MADA')
  const [firstAlsoAmount, setFirstAlsoAmount] = useState(0)

  const [secondAlso, setSecondAlso] = useState(false)
  const [secondAlsoMethod, setSecondAlsoMethod] = useState<PaymentMethod>('CARD')
  const [secondAlsoScheme, setSecondAlsoScheme] = useState<CardScheme>('MADA')
  const [secondAlsoAmount, setSecondAlsoAmount] = useState(0)

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

  const firstPart = split ? Math.min(Math.max(0, round2(firstAmount)), round2(total)) : round2(total)
  const secondPart = split ? round2(total - firstPart) : 0
  const splitCoversEverything = split && secondPart <= 0
  const splitTakesNothing = split && firstPart <= 0

  /*
   * How much of each share goes on each of that party's two methods.
   *
   * The second method takes what the agent typed; the first takes whatever is left. Doing it that
   * way round means the two always add up to the share exactly — there is no third box to get out
   * of step, and no rounding left over for somebody to argue about at the counter.
   */
  const firstSecondary = firstAlso ? Math.min(Math.max(0, round2(firstAlsoAmount)), firstPart) : 0
  const firstPrimary = round2(firstPart - firstSecondary)
  const secondSecondary = secondAlso ? Math.min(Math.max(0, round2(secondAlsoAmount)), secondPart) : 0
  const secondPrimary = round2(secondPart - secondSecondary)

  /** A share split across methods needs both halves to be real money. */
  const methodSplitOk = (on: boolean, share: number, part: number, m: PaymentMethod, sc: CardScheme) =>
    !on || (part > 0 && part < share && (m !== 'CARD' || !!sc))

  const firstMethodsOk = methodSplitOk(firstAlso, firstPart, firstSecondary, firstAlsoMethod, firstAlsoScheme)
  const secondMethodsOk = methodSplitOk(secondAlso, secondPart, secondSecondary, secondAlsoMethod, secondAlsoScheme)

  const splitReady =
    (!split || (!!payer && firstPart > 0 && secondPart > 0 && (secondMethod !== 'CARD' || !!secondScheme))) &&
    firstMethodsOk &&
    secondMethodsOk

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
              : !firstMethodsOk || !secondMethodsOk
                ? t('payment.methodPartOutOfRange')
                : ''

  const confirm = () => {
    /*
     * One line per method per payer, and nothing that takes nothing.
     *
     * The till and the invoice both read this list, so a zero line would print a payment that
     * never happened. A party paying one way produces one line, exactly as before.
     */
    const lines: PaymentSplit[] = []
    const add = (m: PaymentMethod, sc: CardScheme, amount: number, payerId?: string) => {
      if (amount <= 0) return
      lines.push({ method: m, cardScheme: m === 'CARD' ? sc : null, amount, ...(payerId ? { payerId } : {}) })
    }

    add(method, scheme, firstPrimary)
    if (firstAlso) add(firstAlsoMethod, firstAlsoScheme, firstSecondary)

    if (split) {
      add(secondMethod, secondScheme, secondPrimary, payer?.customer._id)
      if (secondAlso) add(secondAlsoMethod, secondAlsoScheme, secondSecondary, payer?.customer._id)
    }

    onConfirm(lines)
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

      <AlsoPayWith
        on={firstAlso}
        setOn={setFirstAlso}
        share={firstPart}
        amount={firstAlsoAmount}
        setAmount={setFirstAlsoAmount}
        method={firstAlsoMethod}
        setMethod={setFirstAlsoMethod}
        scheme={firstAlsoScheme}
        setScheme={setFirstAlsoScheme}
        testId="pay-first-also"
      />

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

          <AlsoPayWith
            on={secondAlso}
            setOn={setSecondAlso}
            share={secondPart}
            amount={secondAlsoAmount}
            setAmount={setSecondAlsoAmount}
            method={secondAlsoMethod}
            setMethod={setSecondAlsoMethod}
            scheme={secondAlsoScheme}
            setScheme={setSecondAlsoScheme}
            testId="pay-second-also"
          />
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
