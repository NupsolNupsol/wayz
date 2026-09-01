import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LifeBuoy, LogOut, ShieldQuestion } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/store/auth'
import { APP } from '@/config/appConfig'

const EXPLAIN: Record<string, string> = {}

export function NoWorkspacePage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.me)
  const logout = useAuthStore((s) => s.logout)

  const role = me?.role ?? ''
  const readable = role.replaceAll('_', ' ').toLowerCase()

  return (
    <div className="min-h-screen flex items-center justify-center p-4" data-testid="no-workspace">
      <Card className="max-w-lg w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center mx-auto mb-4">
          <ShieldQuestion size={28} />
        </div>

        <h1 className="text-xl font-bold text-navy dark:text-dk-texthi">{t('noWorkspace.title')}</h1>
        <p className="text-sm text-muted mt-2">
          You are signed in to {APP.name}
          {me?.fullName ? ` as ${me.fullName}` : ''}
          {role ? ` with the ${readable} role` : ''}, and that role does not have any screens in this release.
        </p>

        {EXPLAIN[role] && <p className="text-sm text-muted mt-3">{EXPLAIN[role]}</p>}

        <div className="lf-card p-3 mt-5 flex items-start gap-3 text-start">
          <LifeBuoy size={18} className="text-brand shrink-0 mt-0.5" />
          <p className="text-sm text-muted">{t('noWorkspace.message')}<strong className="text-navy dark:text-dk-texthi">{t('noWorkspace.team')}</strong>. Your account is fine — it simply has
            nowhere to land.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="secondary"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            data-testid="no-workspace-signout"
          >
            <LogOut size={16} /> {t('common:action.signOut')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
