import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgePercent, Gift } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from './Modal'
import { Button, Field } from './ui'
import { NumberInput } from './NumberInput'
import { useDiscountBooking } from '@/hooks'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/state/toastStore'
import { ApiError } from '@/api/client'
import { money } from '@/utils'

export function DiscountButton({ bookingId, total, onDone }: { bookingId: string; total: number; onDone?: () => void }) {
  const { t } = useTranslation(['ui', 'common'])
  const reasons = useAuthStore((s) => s.me?.tenant?.discountReasons ?? [])
  const discount = useDiscountBooking()

  const [open, setOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState('')
  const [percent, setPercent] = useState(10)
  const [free, setFree] = useState(false)
  const [note, setNote] = useState('')

  if (reasons.length === 0) return null

  const reason = reasons.find((r) => r.code === reasonCode) ?? null
  const asked = free ? 100 : percent
  const overCeiling = !!reason && asked > reason.maxPercent
  const ready = !!reason && asked > 0 && !overCeiling

  const apply = () => {
    if (!reason) return
    discount.mutate(
      { id: bookingId, reasonCode: reason.code, percent: asked, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setOpen(false)
          setNote('')
          toast('success', free ? t('ui:discount.madeFree') : t('ui:discount.applied'), reason.label)
          onDone?.()
        },
        onError: (e) => toast('danger', t('ui:discount.refused'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="discount-open">
        <BadgePercent size={15} /> {t('ui:discount.open')}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('ui:discount.title')}
        subtitle={t('ui:discount.subtitle', { amount: money(total) })}
        testId="discount-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button onClick={apply} loading={discount.isPending} disabled={!ready} data-testid="discount-apply">
              {free ? <Gift size={15} /> : <BadgePercent size={15} />}
              {free ? t('ui:discount.makeFree') : t('ui:discount.take', { percent: asked })}
            </Button>
          </>
        }
      >
        <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2">{t('ui:discount.why')}</p>
        <div className="flex flex-wrap gap-2 mb-4" data-testid="discount-reasons">
          {reasons.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => setReasonCode(r.code)}
              data-testid={`discount-reason-${r.code}`}
              className={clsx(
                'lf-btn !h-9 !px-3 text-xs border',
                reasonCode === r.code ? 'bg-brand text-brand-fg border-brand' : 'bg-surface border-line text-muted hover:text-brand',
              )}
            >
              {r.label}
              <span className="opacity-70">· {r.maxPercent}%</span>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
          <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} data-testid="discount-free" />
          {t('ui:discount.freeRide')}
        </label>

        {!free && (
          <Field label={t('ui:discount.howMuch')} hint={reason ? t('ui:discount.ceiling', { percent: reason.maxPercent }) : undefined}>
            <NumberInput
              min={1}
              max={reason?.maxPercent ?? 100}
              value={percent}
              onChange={setPercent}
              testId="discount-percent"
            />
          </Field>
        )}

        {overCeiling && (
          <p className="text-xs text-danger-strong mb-2" data-testid="discount-over">
            {t('ui:discount.tooMuch', { percent: reason?.maxPercent ?? 0 })}
          </p>
        )}

        <Field label={t('common:field.notes')}>
          <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="discount-note" />
        </Field>
      </Modal>
    </>
  )
}
