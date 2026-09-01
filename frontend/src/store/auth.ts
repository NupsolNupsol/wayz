import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Me } from '../api/types'
import { configureAuth } from '../api/client'
import { applyThemeMode } from './theme'
import { applyLanguage, type Language } from '../i18n'
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
      setSession: (token, me) => set({ token, me }),
      setMe: (me) => set({ me }),
      logout: () => set({ token: null, me: null }),
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
}

export function bootstrapLanguage() {
  applyLanguage(useAuthStore.getState().language ?? 'en')
}
