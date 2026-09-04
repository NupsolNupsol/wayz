import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { PanelLeftClose, X, PackageOpen } from 'lucide-react'
import { ACCOUNTANT_NAV, AGENT_NAV, CAPTAIN_NAV, COURIER_NAV, HR_NAV, MANAGER_NAV, TENANT_ADMIN_NAV } from '@/config/navigation'
import { APP } from '@/config/appConfig'
import { Icon } from '@/components/Icon'
import { useTranslation } from 'react-i18next'
import { can, homeForRole, isAccountantRole, isAgentRole, isCourierRole, isHrRole, isTenantAdminRole } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import type { EngineKind, Role } from '@/models'

function navFor(role: Role) {
  if (isTenantAdminRole(role)) return TENANT_ADMIN_NAV
  if (isAccountantRole(role)) return ACCOUNTANT_NAV
  if (isHrRole(role)) return HR_NAV
  if (isCourierRole(role)) return COURIER_NAV
  if (role === 'CHIEF_CAPTAIN') return CAPTAIN_NAV
  return isAgentRole(role) ? AGENT_NAV : MANAGER_NAV
}

const WORKSPACE_KEY = (role: Role): Role =>
  isAccountantRole(role)
    ? 'ACCOUNTANT'
    : isHrRole(role)
      ? 'HR'
      : isTenantAdminRole(role)
        ? 'TENANT_ADMIN'
        : isCourierRole(role)
          ? 'DELIVERY_AGENT'
          : isAgentRole(role)
            ? 'AGENT'
            : 'MANAGER'

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  role,
  engineKinds,
  tenantLabel,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  role: Role
  engineKinds: EngineKind[]
  tenantLabel: string
}) {
  const { t } = useTranslation(['nav', 'common'])
  const language = useAuthStore((st) => st.language)
  const rtl = language === 'ar'

  const tree = navFor(role)
  const allPaths = tree.flatMap((g) => g.items.map((i) => i.to))

  return (
    <>
      <div
        className={clsx('fixed inset-0 z-[1039] bg-black/45 lg:hidden', mobileOpen ? 'block' : 'hidden')}
        onClick={onCloseMobile}
      />
      <aside
        data-testid="sidebar"
        className={clsx(
          'fixed z-[1040] flex flex-col bg-navy-700 text-white overflow-hidden transition-all duration-300',
          'top-2 start-2 bottom-2 rounded-sidebar shadow-sidebar',
          collapsed ? 'w-20' : 'w-[274px]',
          'lg:translate-x-0',
          mobileOpen
            ? 'translate-x-0'
            : rtl
              ? 'translate-x-[110%] lg:translate-x-0'
              : '-translate-x-[110%] lg:translate-x-0',
          'max-lg:top-0 max-lg:start-0 max-lg:bottom-0 max-lg:rounded-none max-lg:w-[280px]',
        )}
      >
        <div className={clsx('flex items-center justify-between px-5 py-6 border-b border-white/15 min-h-[80px]', collapsed && 'justify-center px-0')}>
          <NavLink to={homeForRole(role)} className="flex items-center gap-3 overflow-hidden no-underline">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0 shadow">
              <PackageOpen size={24} className="text-brand" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="text-[17px] font-bold text-white">{APP.name}</div>
                <div className="text-[11px] text-white/60">
                  {tenantLabel} · {t(`common:workspace.${WORKSPACE_KEY(role)}`)}
                </div>
              </div>
            )}
          </NavLink>
          <button className="lg:hidden text-white/70 p-1.5" onClick={onCloseMobile} aria-label={t('common:header.closeMenu')}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4">
          {tree.map((group) => {
            const items = group.items.filter(
              (it) =>
                (!it.permission || can(role, it.permission)) &&
                (!it.engineKind || !engineKinds.length || engineKinds.includes(it.engineKind)),
            )
            if (items.length === 0) return null
            return (
              <div key={group.id} className="mb-4">
                {!collapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    {t(`nav:group.${group.id}`, { defaultValue: group.label })}
                  </p>
                )}
                {items.map((it) => (
                  <NavLink
                    key={it.id}
                    to={it.to}
                    end={allPaths.some((p) => p !== it.to && p.startsWith(`${it.to}/`))}
                    data-testid={it.testId}
                    onClick={onCloseMobile}
                    title={collapsed ? t(`nav:item.${it.id}`, { defaultValue: it.label }) : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center gap-3.5 px-4 py-3 rounded-xl2 text-sm font-medium mb-1 transition-colors no-underline',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-white/20 text-white font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon name={it.icon} size={20} className="shrink-0" />
                        {!collapsed && (
                          <span className="flex-1">{t(`nav:item.${it.id}`, { defaultValue: it.label })}</span>
                        )}
                        {!collapsed && isActive && <span className="absolute end-3 top-3.5 bottom-3.5 w-1 rounded bg-white" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/15 max-lg:hidden">
          <button
            onClick={onToggleCollapse}
            data-testid="sidebar-collapse"
            className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl2 bg-white/10 text-white/85 hover:bg-white/20 w-full text-sm font-semibold', collapsed && 'justify-center px-0')}
          >
            <PanelLeftClose size={18} className={clsx('transition-transform lf-arrow-flip', collapsed && 'rotate-180')} />
            {!collapsed && <span>{t('common:header.collapse')}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
