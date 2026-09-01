import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Wifi, WifiOff, Moon, Sun, ChevronDown, LogOut, UserCog, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/auth'
import { LanguageToggle } from '@/components/LanguageToggle'
import { originFromEvent } from '@/lib/viewTransition'
import { useSearch } from '@/hooks'
import { initials } from '@/utils'
import type { Me, Role } from '@/api/types'
import type { SearchHit } from '@/api/search.api'

const SEARCHABLE_ROLES: Role[] = ['AGENT', 'CASHIER', 'MANAGER', 'TENANT_ADMIN', 'ACCOUNTANT']

/** Which of the placeholder wordings this role gets. */
const SEARCH_SCOPE: Partial<Record<Role, string>> = {
  AGENT: 'operations',
  CASHIER: 'operations',
  MANAGER: 'operations',
  TENANT_ADMIN: 'admin',
  ACCOUNTANT: 'finance',
}

/** Every role reaches the same record through its own workspace. */
function routeForHit(hit: SearchHit, role: Role): string {
  const manager = role === 'MANAGER' || role === 'TENANT_ADMIN'
  switch (hit.kind) {
    case 'BOOKING':
      return manager ? `/manager/rentals/${hit.id}` : `/bookings/${hit.id}`
    case 'CUSTOMER':
      return manager ? `/manager/customers/${hit.id}` : `/customers/${hit.id}`
    case 'PAYMENT':
      return `/accounting/settlement/payments/${hit.id}`
    case 'TRANSACTION':
      return `/accounting/settlement/transactions/${hit.id}`
  }
}

export function Header({ onOpenMobile, me, dataSw }: { onOpenMobile: () => void; me: Me; dataSw: 'wide' | 'narrow' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const online = useAuthStore((s) => s.online)
  const setOnline = useAuthStore((s) => s.setOnline)
  const theme = useAuthStore((s) => s.theme)
  const toggleTheme = useAuthStore((s) => s.toggleTheme)
  const logout = useAuthStore((s) => s.logout)

  const [query, setQuery] = useState('')
  const [userOpen, setUserOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const searchable = SEARCHABLE_ROLES.includes(me.role)
  const { data: results = [], isFetching } = useSearch(query, searchable)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setUserOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const openHit = (hit: SearchHit) => {
    navigate(routeForHit(hit, me.role))
    setQuery('')
    setSearchOpen(false)
  }

  return (
    <header
      data-testid="app-header"
      data-sw={dataSw}
      className="lf-app-header fixed top-0 left-0 right-0 z-[1030] h-20 bg-canvas dark:bg-dk-bg flex items-center gap-4 px-4 lg:px-6"
    >
      <button onClick={onOpenMobile} className="lg:hidden text-muted p-2" aria-label={t('header.openMenu')} data-testid="mobile-menu-btn">
        <Menu size={22} />
      </button>

      <div className="hidden xl:block shrink-0">
        <div className="text-[18px] font-bold text-navy dark:text-dk-texthi leading-none">
          {t('header.welcome', { name: me.fullName.split(' ')[0] })}
        </div>
        <div className="text-xs text-muted mt-1 flex items-center gap-1">
          <MapPin size={12} /> {me.tenant?.name} · {me.station?.name}
        </div>
      </div>

      <div className="flex-1 flex justify-center min-w-0 px-2 md:px-6">
        {searchable && (
          <div className="relative w-full max-w-[440px]" ref={searchRef}>
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              data-testid="global-search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) }
                if (e.key === 'Enter' && results.length) openHit(results[0])
              }}
              placeholder={t(`header.searchPlaceholder.${SEARCH_SCOPE[me.role] ?? 'default'}`)}
              className="w-full h-[38px] ps-9 pe-3 rounded-[10px] bg-surface dark:bg-dk-elevated border-[1.5px] border-line text-sm outline-none focus:border-brand"
            />
            {searchOpen && query.trim().length >= 2 && (
              <div className="absolute top-[calc(100%+6px)] left-0 right-0 lf-card p-1 shadow-pop z-[9999] max-h-[70vh] overflow-y-auto scroll-thin" data-testid="search-results">
                {results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted" data-testid="search-empty">
                    {isFetching ? t('state.searching') : t('state.noMatch')}
                  </p>
                ) : (
                  results.map((hit) => (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      onMouseDown={() => openHit(hit)}
                      data-testid={`search-hit-${hit.id}`}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-canvas dark:hover:bg-dk-elevated text-start"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted w-16 shrink-0">
                        {t(`header.hit.${hit.kind}`)}
                      </span>
                      <span className="font-medium truncate">{hit.label}</span>
                      <span className="text-muted text-xs ms-auto truncate max-w-[45%]">{hit.sublabel}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0" ref={ref}>
        <button onClick={() => setOnline(!online)} title={online ? t('header.online') : t('header.offline')} data-testid="connectivity-toggle" className={clsx('p-2 rounded-lg', online ? 'text-success hover:bg-black/5' : 'text-danger-strong bg-red-50')}>
          {online ? <Wifi size={18} /> : <WifiOff size={18} />}
        </button>
        <LanguageToggle compact />
        <button onClick={(e) => toggleTheme(originFromEvent(e))} className="p-2 rounded-lg text-muted hover:bg-black/5" aria-label={t('header.toggleTheme')} data-testid="theme-toggle">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <div className="w-px h-7 bg-line mx-1.5" />
        <div className="relative">
          <button onClick={() => setUserOpen(!userOpen)} className="flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] hover:bg-black/5" data-testid="user-menu-btn">
            <div className="w-[34px] h-[34px] rounded-full bg-brand text-brand-fg text-[13px] font-bold flex items-center justify-center">{initials(me.fullName)}</div>
            <div className="hidden md:block text-start leading-tight max-w-[120px]">
              <div className="text-[13px] font-semibold text-navy dark:text-dk-texthi truncate">{me.fullName}</div>
              <div className="text-[11px] text-muted truncate">{t(`role.${me.role}`)}</div>
            </div>
            <ChevronDown size={14} className="text-muted" />
          </button>
          {userOpen && (
            <div className="absolute top-[calc(100%+8px)] end-0 w-44 lf-card p-1 shadow-pop z-[9999]" data-testid="user-dropdown">
              <button onClick={() => { navigate('/profile'); setUserOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-canvas dark:hover:bg-dk-elevated text-start">
                <UserCog size={15} /> {t('header.profile')}
              </button>
              <button onClick={() => { logout(); navigate('/login') }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-red-50 text-danger-strong text-start" data-testid="logout-btn">
                <LogOut size={15} /> {t('action.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
