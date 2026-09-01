import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface UiState {
  theme: Theme
  /** Handhelds are used one-handed on the move; larger touch targets help. */
  compact: boolean
  toggleTheme: () => void
  setCompact: (compact: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'light',
  compact: false,
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setCompact: (compact) => set({ compact }),
}))
