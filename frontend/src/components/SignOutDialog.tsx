import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LogOut, TriangleAlert } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Badge, Button } from '@/components/ui'
import { useBookings, useShift } from '@/hooks'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/store/auth'
import { isAgentRole } from '@/permissions/permissions'
import { money } from '@/utils'

const LIVE = ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS', 'PREPARING', 'CONFIRMED', 'RESERVED']

export function SignOutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(['common', 'agent'])
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.me?.role)
  const logout = useAuthStore((s) => s.logout)
  const isDesk = isAgentRole(role)

  const { data: bookings = [] } = useBookings(undefined, { enabled: open && isDesk })
  const { data: shift } = useShift(open && isDesk)

  const live = bookings.filter((b) => LIVE.includes(b.status))
  const owed = live.reduce((sum, b) => sum + (b.amountDue ?? 0), 0)
  const tillOpen = !!shift && shift.status !== 'CLOSED'

  const signOut = async () => {
    await authApi.logout().catch(() => undefined)
    logout()
    navigate('/login')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('common:signOut.title')}
      subtitle={t('common:signOut.subtitle')}
      testId="signout-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-testid="signout-cancel">{t('common:action.cancel')}</Button>
          <Button variant="danger" onClick={() => void signOut()} data-testid="signout-confirm">
            <LogOut size={15} /> {t('common:action.signOut')}
          </Button>
        </>
      }
    >
      {isDesk && (live.length > 0 || tillOpen) ? (
        <div data-testid="signout-warnings">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">
            <TriangleAlert size={16} /> {t('agent:signOut.stillOpen')}
          </p>

          {live.length > 0 && (
            <div className="lf-card p-3 mb-2" data-testid="signout-live-operations">
              <p className="text-sm font-medium mb-1">
                {t('agent:signOut.liveCount', { count: live.length })}
              </p>
              <ul className="text-xs text-muted flex flex-col gap-1">
                {live.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono">{b.ref}</span>
                    <span className="truncate">{b.customerName}</span>
                    {(b.amountDue ?? 0) > 0 && <Badge tone="warning">{money(b.amountDue ?? 0)}</Badge>}
                  </li>
                ))}
                {live.length > 5 && <li>{t('agent:signOut.andMore', { count: live.length - 5 })}</li>}
              </ul>
              {owed > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2" data-testid="signout-owed">
                  {t('agent:signOut.owed', { amount: money(owed) })}
                </p>
              )}
            </div>
          )}

          {tillOpen && (
            <div className="lf-card p-3" data-testid="signout-till-open">
              <p className="text-sm font-medium">{t('agent:signOut.tillOpen')}</p>
              <p className="text-xs text-muted mt-1">{t('agent:signOut.tillOpenHint')}</p>
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  onClose()
                  navigate('/till/shift')
                }}
                data-testid="signout-go-shift"
              >
                {t('agent:signOut.closeShift')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted" data-testid="signout-clean">{t('common:signOut.nothingOpen')}</p>
      )}
    </Modal>
  )
}
