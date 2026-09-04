import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Calculator, MapPinOff } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { useUnitReturnPosition } from '@/hooks'
import { bookingApi } from '@/api/booking.api'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'
import { useAuthStore } from '@/store/auth'
import { isAgentRole } from '@/permissions/permissions'

export function WrongDeskBanner({ unitId }: { unitId: string }) {
  const { t } = useTranslation(['assets', 'common'])
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.me?.role)
  const isDesk = isAgentRole(role)

  const { data } = useUnitReturnPosition(unitId, isDesk)
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)

  if (!data || data.belongsHere) return null

  const takeItBack = async () => {
    if (!data.booking) return
    setWorking(true)
    try {
      const result = await bookingApi.returnHere(data.booking.id, 'TO_RETURNED')
      toast(
        'warning',
        t('wrongDesk.takenBack'),
        result.wrongStation ? t('wrongDesk.charged', { amount: money(data.wrongDeskPenalty) }) : '',
      )
      setConfirming(false)
      navigate(`/bookings/${data.booking!.id}`)
    } catch (e) {
      toast('danger', t('wrongDesk.failed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : String(e))
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <Card className="mb-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20" data-testid="wrong-desk-banner">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
              <MapPinOff size={17} /> {t('wrongDesk.title')}
            </p>
            <p className="text-sm text-amber-800/90 dark:text-amber-200/90 mt-1">
              {t('wrongDesk.body', { unit: data.identifier, desk: data.homeKioskName ?? t('wrongDesk.anotherDesk') })}
            </p>
            {data.booking ? (
              <p className="text-xs text-muted mt-1" data-testid="wrong-desk-booking">
                {t('wrongDesk.onRental', { ref: data.booking.ref, customer: data.booking.customerName })}
              </p>
            ) : (
              <p className="text-xs text-muted mt-1" data-testid="wrong-desk-idle">{t('wrongDesk.noRental')}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge tone="warning" testId="wrong-desk-penalty">
              {t('wrongDesk.penalty', { amount: money(data.wrongDeskPenalty) })}
            </Badge>
            {data.booking && (
              <Button variant="secondary" onClick={() => setConfirming(true)} data-testid="wrong-desk-calculate">
                <Calculator size={15} /> {t('wrongDesk.calculate')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('wrongDesk.confirmTitle')}
        subtitle={t('wrongDesk.confirmSubtitle')}
        testId="wrong-desk-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={() => void takeItBack()} loading={working} data-testid="wrong-desk-confirm">
              {t('wrongDesk.takeBack')}
            </Button>
          </>
        }
      >
        <ul className="text-sm text-muted flex flex-col gap-1.5">
          <li>{t('wrongDesk.willCharge', { amount: money(data.wrongDeskPenalty) })}</li>
          <li>{t('wrongDesk.willEnd', { ref: data.booking?.ref ?? '' })}</li>
          <li>{t('wrongDesk.willRehome')}</li>
        </ul>
      </Modal>
    </>
  )
}
