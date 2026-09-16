import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Me } from '../api/types'
import type { PlatformIdentity } from '../api/platform.api'
import { configureAuth } from '../api/client'
import { applyThemeMode } from './theme'
import { applyLanguage, type Language } from '../i18n'
import { forgetPaintedBrand, paintBrandFor } from './tenant'
import { queryClient } from '../lib/queryClient'
import { runViewTransition } from '../lib/viewTransition'

interface AuthState {
  token: string | null
  me: Me | null
  /**
   * Set instead of `me` when whoever signed in runs the platform rather than working at one of
   * its companies. The two are never both set: a session is one or the other, exactly as the
   * two token kinds on the API are.
   */
  platform: PlatformIdentity | null
  online: boolean
  theme: 'light' | 'dark'
  language: Language
  setSession: (token: string, me: Me) => void
  setPlatformSession: (token: string, platform: PlatformIdentity) => void
  setMe: (me: Me) => void
  logout: () => void
  setOnline: (online: boolean) => void
  toggleTheme: (origin?: { x: number; y: number }) => void
  setLanguage: (language: Language, origin?: { x: number; y: number }) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      me: null,
      platform: null,
      online: true,
      theme: 'light',
      language: 'en',
      setSession: (token, me) => {
        // The colours land before the first branded pixel, not after a flash of the default.
        paintBrandFor(me.tenant?.id ?? null, me.tenant?.branding ?? null)
        set({ token, me, platform: null })
      },
      /**
       * A platform session wears the platform's own palette, not a company's.
       *
       * There is no organisation to take colours from, and picking one would be worse than
       * neutral — the console shows every company, so looking like one of them would be a lie.
       */
      setPlatformSession: (token, platform) => {
        paintBrandFor(null)
        set({ token, platform, me: null })
      },
      setMe: (me) => {
        paintBrandFor(me.tenant?.id ?? null, me.tenant?.branding ?? null)
        set({ me })
      },
      /**
       * Ends the session. Deliberately does **not** decide what colour the screen becomes.
       *
       * It used to reset the branding outright, which is why a mistyped password on WIQAR's
       * sign-in page turned it turquoise: the failed attempt reached the global sign-out
       * handler, and the handler repainted the platform's palette over a tenant's own door.
       *
       * Whose page this is has never been a property of the session — it is a property of the
       * address. So this forgets what is painted and asks the address, which answers "still
       * WIQAR" on WIQAR's door and "nobody" on the platform's.
       */
      logout: () => {
        set({ token: null, me: null, platform: null })

        /*
         * Everything the old session fetched goes with it.
         *
         * React Query keys are scoped by what was asked for, not by who asked, so a cached
         * `['bookings']` from one tenant would be served instantly to the next person to sign
         * in — including, on a shared machine, somebody from a different company. Clearing is
         * cheap; the alternative is a cross-tenant data leak that looks like a stale render.
         */
        queryClient.clear()

        forgetPaintedBrand()
        // Nobody is signed in, so the screen goes back to the platform's own palette.
        paintBrandFor(null)
      },
      setOnline: (online) => set({ online }),
      toggleTheme: (origin) => {
        const next = get().theme === 'light' ? 'dark' : 'light'
        runViewTransition(
          () => {
            applyThemeMode(next)
            set({ theme: next })
          },
          'theme',
          origin,
        )
      },
      setLanguage: (language, origin) => {
        if (get().language === language) return
        runViewTransition(
          () => {
            applyLanguage(language)
            set({ language })
          },
          'language',
          origin,
        )
      },
    }),
    { name: 'wayz.platform.auth' },
  ),
)

configureAuth(
  () => useAuthStore.getState().token,
  () => useAuthStore.getState().logout(),
)

export function bootstrapTheme() {
  applyThemeMode(useAuthStore.getState().theme)

  /*
   * A reload comes back wearing the right colours before the first paint.
   *
   * The persisted session carries the organisation's branding, so there is nothing to fetch
   * and no frame in which the wrong brand could show. Signed out, it is the platform's.
   */
  const me = useAuthStore.getState().me
  paintBrandFor(me?.tenant?.id ?? null, me?.tenant?.branding ?? null)
}

export function bootstrapLanguage() {
  applyLanguage(useAuthStore.getState().language ?? 'en')
}
