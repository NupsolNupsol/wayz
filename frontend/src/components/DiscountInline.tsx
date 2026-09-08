import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgePercent, Check } from 'lucide-react'
import { Button } from './ui'
import { Select } from './Select'
import { NumberInput } from './NumberInput'
import { useDiscountBooking } from '@/hooks'
import { useAuthStore } from '@/store/auth'
import { ApiError } from '@/api/client'
import { money } from '@/utils'

/**
 * A tick box on the payment step, because this happens often enough that a modal is in the way.
 * The reason is not optional: every free ride and every discount is reported and summed, so it
 * has to say what it was for.
 */
export function DiscountInline({
  bookingId,
  total,
  onApplied,
}: {
  bookingId: string
  total: number
  onApplied?: () => void
}) {
  const { t } = useTranslation(['ui', 'common'])
  const reasons = useAuthStore((s) => s.me?.tenant?.discountReasons ?? [])
  const discount = useDiscountBooking()

  const [open, setOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState('')
  const [free, setFree] = useState(false)
  const [percent, setPercent] = useState(10)
  const [applied, setApplied] = useState<{ amount: number; label: string; free: boolean } | null>(null)
  const [problem, setProblem] = useState('')

  if (reasons.length === 0) return null

  const reason = reasons.find((r) => r.code === reasonCode) ?? null
  const asked = free ? 100 : percent
  const overCeiling = !!reason && asked > reason.maxPercent
  const ready = !!reason && asked > 0 && !overCeiling

  const apply = () => {
    if (!reason) {
      setProblem(t('ui:discount.reasonRequired'))
      return
    }
    setProblem('')
    discount.mutate(
      { id: bookingId, reasonCode: reason.code, percent: asked },
      {
        onSuccess: () => {
          setApplied({ amount: Math.round(total * (asked / 100) * 100) / 100, label: reason.label, free })
          setOpen(false)
          onApplied?.()
        },
        onError: (e) => setProblem(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : t('ui:discount.refused')),
      },
    )
  }

  if (applied) {
    return (
      <div
        className="mb-3 rounded-xl2 border border-success/40 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 flex items-center gap-2 text-sm"
        data-testid="discount-applied"
      >
        <Check size={16} className="text-success shrink-0" />
        <span className="text-navy dark:text-dk-text">
          {applied.free
            ? t('ui:discount.freeApplied', { reason: applied.label })
            : t('ui:discount.someApplied', { amount: money(applied.amount), reason: applied.label })}
        </span>
      </div>
    )
  }

  return (
    <div className="mb-3" data-testid="discount-inline">
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 accent-[rgb(var(--brand))]"
          checked={open}
          onChange={(e) => {
            setOpen(e.target.checked)
            setProblem('')
          }}
          data-testid="discount-toggle"
        />
        <BadgePercent size={15} className="text-muted" />
        <span className="text-navy dark:text-dk-text">{t('ui:discount.inlineLabel')}</span>
      </label>

      {open && (
        <div className="mt-2 rounded-xl2 border border-line dark:border-dk-border p-3" data-testid="discount-panel">
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">
            {t('ui:discount.whyRequired')}
          </p>
          <Select
            value={reasonCode}
            onChange={(v) => {
              setReasonCode(v)
              setProblem('')
            }}
            options={[
              { label: t('ui:discount.pickReason'), value: '' },
              ...reasons.map((r) => ({ label: `${r.label} · up to ${r.maxPercent}%`, value: r.code })),
            ]}
            testId="discount-reason"
          />

          <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[rgb(var(--brand))]"
              checked={free}
              onChange={(e) => setFree(e.target.checked)}
              data-testid="discount-free"
            />
            {t('ui:discount.freeRide')}
          </label>

          {!free && (
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-1.5">
                  {t('ui:discount.howMuch')}
                </p>
                <NumberInput min={1} max={reason?.maxPercent ?? 100} value={percent} onChange={setPercent} testId="discount-percent" />
              </div>
            </div>
          )}

          {overCeiling && (
            <p className="text-xs text-danger-strong mt-2" data-testid="discount-over">
              {t('ui:discount.tooMuch', { percent: reason?.maxPercent ?? 0 })}
            </p>
          )}
          {problem && (
            <p className="text-xs text-danger-strong mt-2" data-testid="discount-problem">
              {problem}
            </p>
          )}

          <Button
            className="mt-3 w-full"
            variant="secondary"
            onClick={apply}
            loading={discount.isPending}
            disabled={!ready}
            data-testid="discount-apply"
          >
            {free ? t('ui:discount.makeFree') : t('ui:discount.take', { percent: asked })}
          </Button>
        </div>
      )}
    </div>
  )
}
