import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Building2,
  ChevronRight,
  Gauge,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react'

import { applyThemeMode } from '@/store/theme'
import { usePlatformSession } from './platformClient'

/**
 * The control plane's frame.
 *
 * Built from the same pieces as a tenant workspace — the floating rounded sidebar, the fixed
 * header, the light canvas, `lf-card`, `lf-input`, the same spacing and the same dark mode.
 * One codebase should look like one product, and an operator who knows their way around a
 * tenant workspace already knows their way around this.
 *
 * What tells them apart is **identity, not chrome**: the control plane wears indigo, which is
 * nobody's tenant, and says "Control plane · no tenant data" in its header. The earlier
 * version made the distinction by being dark all over, which achieved the same thing by
 * looking like a different application built by somebody else.
 *
 * A persistent sidebar rather than a row of tabs, because this is an application with nine
 * areas rather than a page with two.
 */

const COLLAPSE_KEY = 'lockerflow.platform.sidebar.collapsed'

interface Section {
  to: string
  label: string
  icon: typeof Gauge
  end?: boolean
  testId: string
}

const SECTIONS: { group: string; items: Section[] }[] = [
  {
    group: 'Platform',
    items: [
      { to: '/platform', label: 'Overview', icon: Gauge, end: true, testId: 'platform-nav-overview' },
      { to: '/platform/tenants', label: 'Tenants', icon: Building2, testId: 'platform-nav-tenants' },
      { to: '/platform/reports', label: 'Reports', icon: BarChart3, testId: 'platform-nav-reports' },
    ],
  },
  {
    /*
     * The knowledge behind the employee assistant. Its own group rather than an entry under
     * Platform: a super admin curating Arabic documentation for eight companies is doing a
     * different job from one provisioning tenants, and the two should not share a heading.
     */
    group: 'Learning',
    items: [
      { to: '/platform/knowledge', label: 'Knowledge base', icon: BookOpenCheck, testId: 'platform-nav-knowledge' },
      { to: '/platform/learning', label: 'Learning analytics', icon: GraduationCap, testId: 'platform-nav-learning' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { to: '/platform/health', label: 'System health', icon: Activity, testId: 'platform-nav-health' },
      { to: '/platform/audit', label: 'Audit log', icon: ScrollText, testId: 'platform-nav-audit' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/platform/administrators', label: 'Administrators', icon: ShieldCheck, testId: 'platform-nav-admins' },
      { to: '/platform/settings', label: 'Settings', icon: Settings, testId: 'platform-nav-settings' },
    ],
  },
]

/** The trail to the current page, built from the address rather than maintained by hand. */
function useCrumbs(): { label: string; to?: string }[] {
  const { pathname } = useLocation()
  const parts = pathname.replace(/^\/platform\/?/, '').split('/').filter(Boolean)

  if (parts.length === 0) return [{ label: 'Overview' }]

  const named: Record<string, string> = {
    tenants: 'Tenants',
    reports: 'Reports',
    health: 'System health',
    audit: 'Audit log',
    knowledge: 'Knowledge base',
    learning: 'Learning analytics',
    administrators: 'Administrators',
    settings: 'Settings',
    new: 'New tenant',
  }

  const crumbs: { label: string; to?: string }[] = [{ label: 'Platform', to: '/platform' }]
  let href = '/platform'
  parts.forEach((part, i) => {
    href += `/${part}`
    const last = i === parts.length - 1
    crumbs.push({ label: named[part] ?? part, to: last ? undefined : href })
  })
  return crumbs
}

export function PlatformShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const admin = usePlatformSession((s) => s.admin)
  const token = usePlatformSession((s) => s.token)
  const theme = usePlatformSession((s) => s.theme)
  const signOut = usePlatformSession((s) => s.signOut)
  const toggleTheme = usePlatformSession((s) => s.toggleTheme)

  const crumbs = useCrumbs()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => applyThemeMode(theme), [theme])
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'), [collapsed])

  if (!token) return <Navigate to="/platform/login" replace />

  const sw = collapsed ? 'narrow' : 'wide'

  return (
    <div data-testid="platform-shell" data-platform-theme={theme}>
      {/* ------------------------------------------------------------ sidebar */}
      <div
        className={clsx('fixed inset-0 z-[1039] bg-black/45 lg:hidden', mobileOpen ? 'block' : 'hidden')}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        data-testid="platform-sidebar"
        className={clsx(
          'fixed z-[1040] flex flex-col bg-navy-700 text-white overflow-hidden transition-all duration-300',
          'top-2 start-2 bottom-2 rounded-sidebar shadow-sidebar',
          collapsed ? 'w-20' : 'w-[274px]',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-[110%] lg:translate-x-0',
          'max-lg:top-0 max-lg:start-0 max-lg:bottom-0 max-lg:rounded-none max-lg:w-[280px]',
        )}
      >
        <div
          className={clsx(
            'flex items-center justify-between px-5 py-6 border-b border-white/15 min-h-[80px]',
            collapsed && 'justify-center px-0',
          )}
        >
          <Link to="/platform" className="flex items-center gap-3 overflow-hidden no-underline">
            <span className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0 shadow">
              <Layers size={22} className="text-brand" />
            </span>
            {!collapsed && (
              <span className="leading-tight">
                <span className="block text-[17px] font-bold text-white">LockerFlow</span>
                <span className="block text-[11px] text-white/60">Control plane</span>
              </span>
            )}
          </Link>
          <button
            className="lg:hidden text-white/70 p-1.5"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4">
          {SECTIONS.map((section) => (
            <div key={section.group} className="mb-4">
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  {section.group}
                </p>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  data-testid={item.testId}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'relative flex items-center gap-3.5 px-4 py-3 rounded-xl2 text-sm font-medium mb-1 transition-colors no-underline',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-white/20 text-white font-semibold'
                        : 'text-white/80 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={20} className="shrink-0" />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && isActive && (
                        <span className="absolute end-3 top-3.5 bottom-3.5 w-1 rounded bg-white" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/15 max-lg:hidden">
          <button
            onClick={() => setCollapsed((c) => !c)}
            data-testid="platform-sidebar-collapse"
            className={clsx(
              'flex items-center gap-3 px-4 py-3 rounded-xl2 bg-white/15 text-white hover:bg-white/25 w-full text-sm font-semibold transition-colors',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- header */}
      <header
        className="lf-app-header fixed top-0 inset-x-0 z-[1030] h-20 bg-surface border-b border-line flex items-center gap-3 px-4 sm:px-6"
        data-sw={sw}
      >
        <button
          className="lg:hidden w-10 h-10 rounded-xl2 hover:bg-canvas flex items-center justify-center shrink-0"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          data-testid="platform-nav-toggle"
        >
          <Menu size={20} />
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 text-sm min-w-0" data-testid="platform-breadcrumbs">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <ChevronRight size={14} className="text-muted shrink-0" />}
                {c.to ? (
                  <Link to={c.to} className="text-muted hover:text-ink truncate no-underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="font-bold text-ink truncate">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <span
          className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted rounded-pill border border-line px-2.5 py-1 shrink-0"
          data-testid="platform-scope-badge"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Control plane · no tenant data
        </span>

        <button
          onClick={toggleTheme}
          data-testid="platform-theme-toggle"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          className="w-10 h-10 rounded-xl2 hover:bg-canvas flex items-center justify-center text-muted hover:text-ink shrink-0"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="flex items-center gap-2.5 shrink-0 ps-2 border-s border-line">
          <span className="w-9 h-9 rounded-full bg-brand/12 text-brand font-bold text-[13px] flex items-center justify-center">
            {(admin?.fullName ?? 'PA')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="hidden sm:block leading-tight min-w-0">
            <span className="block text-[13px] font-bold text-ink truncate max-w-[150px]" data-testid="platform-admin-name">
              {admin?.fullName}
            </span>
            <span className="block text-[11px] text-muted truncate max-w-[150px]">Super admin</span>
          </span>
          <button
            onClick={() => {
              signOut()
              navigate('/platform/login', { replace: true })
            }}
            data-testid="platform-sign-out"
            aria-label="Sign out"
            title="Sign out"
            className="w-10 h-10 rounded-xl2 hover:bg-canvas flex items-center justify-center text-muted hover:text-ink"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* --------------------------------------------------------------- page */}
      <main className="lf-shell-main pt-20 min-h-screen" data-sw={sw}>
        <div className="p-4 sm:p-6 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
