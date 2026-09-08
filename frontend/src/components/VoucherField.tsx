import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ticket, Check } from 'lucide-react'
import { Button } from './ui'
import { useRedeemVoucher } from '@/hooks'
import { ApiError } from '@/api/client'

/**
 * The customer says "I have a code". It sits on the payment step as a field, not behind a button:
 * the agent types it, presses Apply, and the quote beside them drops before any money is taken.
 */
export function VoucherField({ bookingId, onApplied }: { bookingId: string; onApplied?: () => void }) {
  const { t } = useTranslation(['ui', 'common'])
  const redeem = useRedeemVoucher()

  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<{ code: string; percent: number; name: string } | null>(null)
  const [problem, setProblem] = useState('')

  const apply = () => {
    const value = code.trim().toUpperCase()
    if (value.length < 3) return
    setProblem('')
    redeem.mutate(
      { id: bookingId, code: value },
      {
        onSuccess: (res) => {
          setApplied({ code: res.code, percent: res.percent, name: res.name })
          setCode('')
          onApplied?.()
        },
        onError: (e) =>
          setProblem(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : t('ui:voucher.refused')),
      },
    )
  }

  if (applied) {
    return (
      <div
        className="mb-3 rounded-xl2 border border-success/40 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 flex items-center gap-2 text-sm"
        data-testid="voucher-applied"
      >
        <Check size={16} className="text-success shrink-0" />
        <span className="text-navy dark:text-dk-text">
          {t('ui:voucher.appliedLine', { percent: applied.percent, name: applied.name })}
        </span>
        <span className="ms-auto font-mono text-xs tracking-widest text-muted">{applied.code}</span>
      </div>
    )
  }

  return (
    <div className="mb-3" data-testid="voucher-field">
      <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">{t('ui:voucher.label')}</p>
      <div className="flex gap-2">
        <input
          className="lf-input font-mono tracking-widest uppercase flex-1"
          value={code}
          placeholder="WZ-4F7K2Q"
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            if (problem) setProblem('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply()
          }}
          data-testid="voucher-code"
        />
        <Button
          variant="secondary"
          onClick={apply}
          loading={redeem.isPending}
          disabled={code.trim().length < 3}
          data-testid="voucher-apply"
        >
          <Ticket size={15} /> {t('ui:voucher.apply')}
        </Button>
      </div>
      {problem ? (
        <p className="text-xs text-danger-strong mt-1.5" data-testid="voucher-problem">
          {problem}
        </p>
      ) : (
        <p className="text-xs text-muted mt-1.5">{t('ui:voucher.optional')}</p>
      )}
    </div>
  )
}
