import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Wallet, PlayCircle } from 'lucide-react'
import { Button, Field } from './ui'
import { Modal } from './Modal'
import { NumberInput } from './NumberInput'
import { useOpenShift, useShift } from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'

export function TillButton() {
  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.me?.role)
  const hasDrawer = can(role, 'shift.blindCount')

  const { data: shift } = useShift(hasDrawer)
  const shiftPath = role === 'DELIVERY_AGENT' ? '/courier/shift' : '/shift'
  const openMut = useOpenShift()
  const [askFloat, setAskFloat] = useState(false)
  const [float, setFloat] = useState(0)

  if (!hasDrawer) return null

  const isOpen = !!shift && shift.status !== 'CLOSED'

  const open = () =>
    openMut.mutate(float, {
      onSuccess: (s) => {
        setAskFloat(false)
        toast('success', t('shift.openedToast'), t('shift.openedToastDetail', { amount: money(s.expectedCash) }))
      },
      onError: (e) => toast('danger', t('shift.openFailed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
    })

  return (
    <>
      <button
        onClick={() => (isOpen ? navigate(shiftPath) : setAskFloat(true))}
        data-testid={isOpen ? 'till-open-indicator' : 'till-open-cta'}
        title={isOpen ? t('shift.openTillTitle') : t('shift.closedTillTitle')}
        className={clsx(
          'flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs font-semibold transition-colors',
          isOpen
            ? 'text-success bg-success/10 hover:bg-success/20'
            : 'text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-900/30',
        )}
      >
        {isOpen ? <Wallet size={15} /> : <PlayCircle size={15} />}
        <span className="hidden sm:inline">{isOpen ? money(shift.expectedCash) : t('shift.openTill')}</span>
      </button>

      <Modal
        open={askFloat}
        onClose={() => setAskFloat(false)}
        title={t('shift.openTillTitle2')}
        subtitle={t('shift.openTillBlurb')}
        size="sm"
        testId="till-open-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskFloat(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={open} loading={openMut.isPending} data-testid="till-open-confirm">
              <PlayCircle size={15} /> {t('shift.openTill')}
            </Button>
          </>
        }
      >
        <Field label={t('shift.openingFloat')} hint={t('shift.openingFloatHint')}>
          <NumberInput value={float} onChange={setFloat} min={0} step={50} testId="till-opening-float" />
        </Field>
      </Modal>
    </>
  )
}
