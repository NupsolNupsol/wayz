import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { Modal } from './Modal'
import { Button, Field } from './ui'
import { CustomerPicker } from './CustomerPicker'
import { OtpBox } from './OtpBox'
import { NumberInput } from './NumberInput'
import { money, round2 } from '@/utils'
import type { Customer } from '@/api/types'

export interface SecondPayer {
  customer: Customer
  amount: number
}

/**
 * The other half of a split sale.
 *
 * A customer asks a friend to cover part of it. That friend is a customer in their own right —
 * their half goes on their name and their receipt — so they are found or put on file, confirmed
 * with a code the same way, and only then does the amount become payable.
 *
 * Half of the total is offered because that is what people mean by splitting it; the agent can
 * type anything up to the whole sale over the top.
 */
export function SecondPayerModal({
  open,
  total,
  onClose,
  onConfirm,
}: {
  open: boolean
  total: number
  onClose: () => void
  onConfirm: (payer: SecondPayer) => void
}) {
  const { t } = useTranslation(['ui', 'common'])

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [verified, setVerified] = useState(false)
  const [amount, setAmount] = useState(round2(total / 2))

  // Reopening starts clean: the last friend's confirmation has nothing to do with this sale.
  useEffect(() => {
    if (!open) return
    setCustomer(null)
    setVerified(false)
    setAmount(round2(total / 2))
  }, [open, total])

  // A different person needs their own code.
  useEffect(() => setVerified(false), [customer?._id])

  const share = round2(Math.min(Math.max(0, amount), total))
  const theirs = round2(total - share)

  const problem = !customer
    ? t('ui:split.pickSomeone')
    : !verified
      ? t('ui:split.confirmThem')
      : share <= 0
        ? t('ui:split.shareTooSmall')
        : theirs <= 0
          ? t('ui:split.shareTooBig')
          : ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('ui:split.title')}
      subtitle={t('ui:split.subtitle')}
      size="md"
      testId="second-payer-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-testid="second-payer-cancel">
            {t('common:action.cancel')}
          </Button>
          <Button
            onClick={() => customer && onConfirm({ customer, amount: share })}
            disabled={!!problem}
            data-testid="second-payer-confirm"
          >
            <Users size={15} /> {t('ui:split.use', { amount: money(share) })}
          </Button>
        </>
      }
    >
      <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2">{t('ui:split.whoElse')}</p>
      <CustomerPicker value={customer} onChange={setCustomer} />

      {customer && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2">{t('ui:split.confirmTitle')}</p>
          <OtpBox
            phone={customer.phone}
            email={customer.email}
            verified={verified}
            onVerified={setVerified}
          />
        </div>
      )}

      {customer && verified && (
        <div className="mt-4" data-testid="second-payer-amount-row">
          <Field label={t('ui:split.theirShare')} hint={t('ui:split.theirShareHint', { half: money(round2(total / 2)) })}>
            <NumberInput min={0} max={total} step={0.5} value={amount} onChange={setAmount} testId="second-payer-amount" />
          </Field>

          <div className="lf-card p-3 mt-2 text-sm flex items-center justify-between" data-testid="second-payer-breakdown">
            <span className="text-muted">{t('ui:split.breakdown')}</span>
            <span className="font-semibold text-navy dark:text-dk-texthi tabular-nums">
              {money(theirs)} + {money(share)}
            </span>
          </div>
        </div>
      )}

      {problem && (
        <p className="text-xs text-muted mt-3" data-testid="second-payer-problem">
          {problem}
        </p>
      )}
    </Modal>
  )
}
