import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { create } from 'zustand'

import type { EngineKind, Me } from '@/types'

const TOKEN_KEY = 'lockerflow.token'

const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null
    return SecureStore.getItemAsync(key).catch(() => null)
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value)
      return
    }
    await SecureStore.setItemAsync(key, value).catch(() => undefined)
  },
  remove: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key)
      return
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined)
  },
}

interface SessionState {
  token: string | null
  me: Me | null
  ready: boolean
  restore: () => Promise<void>
  signIn: (token: string, me: Me) => Promise<void>
  signOut: () => Promise<void>
  setMe: (me: Me) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  me: null,
  ready: false,

  restore: async () => {
    const token = await storage.get(TOKEN_KEY)
    set({ token, ready: true })
  },

  signIn: async (token, me) => {
    await storage.set(TOKEN_KEY, token)
    set({ token, me })
  },

  signOut: async () => {
    await storage.remove(TOKEN_KEY)
    set({ token: null, me: null })
  },

  setMe: (me) => set({ me }),
}))

export const currentToken = () => useSessionStore.getState().token

export const useMyEngines = (): EngineKind[] => useSessionStore((s) => s.me?.engineKinds ?? [])
