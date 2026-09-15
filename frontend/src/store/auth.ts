import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Me } from '../api/types'
import { configureAuth } from '../api/client'
import { applyThemeMode } from './theme'
import { applyLanguage, type Language } from '../i18n'
import { forgetPaintedBrand, paintBrandFor, resolveTenant } from './tenant'
import { queryClient } from '../lib/queryClient'
import { runViewTransition } from '../lib/viewTransition'

interface AuthState {
  token: string | null
  me: Me | null
  online: boolean
  theme: 'light' | 'dark'
  language: Language
  setSession: (token: string, me: Me) => void
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
      online: true,
      theme: 'light',
      language: 'en',
      setSession: (token, me) => {
        // The colours land before the first branded pixel, not after a flash of the default.
        void paintBrandFor(me.tenant?.slug ?? null, me.tenant?.branding ?? null)
        set({ token, me })
      },
      setMe: (me) => {
        void paintBrandFor(me.tenant?.slug ?? null, me.tenant?.branding ?? null)
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
        set({ token: null, me: null })

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
        void paintBrandFor(resolveTenant(window.location.pathname, null))
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
   * A reload has to come back wearing the right colours before the first paint.
   *
   * The address is asked first, exactly as it is during navigation, so refreshing on a
   * tenant's page keeps that tenant — including when nobody is signed in, which a session-only
   * answer could not do.
   */
  const me = useAuthStore.getState().me
  const slug = resolveTenant(window.location.pathname, me?.tenant?.slug ?? null)
  void paintBrandFor(slug, slug && slug === me?.tenant?.slug ? (me?.tenant?.branding ?? null) : null)
}

export function bootstrapLanguage() {
  applyLanguage(useAuthStore.getState().language ?? 'en')
}
