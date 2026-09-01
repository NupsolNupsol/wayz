import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'
import { applyThemeMode } from '@/store/theme'
import { Toaster } from '@/components/Toaster'

const COLLAPSE_KEY = 'wayz.sidebar.collapsed'

export function AppShell() {
  const { t } = useTranslation()
  const me = useAuthStore((s) => s.me)
  const theme = useAuthStore((s) => s.theme)
  const online = useAuthStore((s) => s.online)
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => applyThemeMode(theme), [theme])
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'), [collapsed])

  if (!me) return null
  const sw = collapsed ? 'narrow' : 'wide'

  return (
    <div>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        role={me.role}
        engineKinds={me.engineKinds ?? []}
        tenantLabel={me.tenant?.name ?? ''}
      />
      <Header onOpenMobile={() => setMobileOpen(true)} me={me} dataSw={sw} />
      <main className="lf-shell-main pt-20 min-h-screen" data-sw={sw}>
        {!online && (
          <div className="mx-4 mt-4 lf-card p-4 border-danger-strong/40 bg-red-50 dark:bg-red-900/20 flex items-start gap-3" data-testid="offline-banner">
            <WifiOff className="text-danger-strong shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-danger-strong">{t('offline.title')}</p>
              <p className="text-sm text-muted">{t('offline.message')}</p>
            </div>
          </div>
        )}
        <div className="p-4 sm:p-6 max-w-[1440px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  )
}
