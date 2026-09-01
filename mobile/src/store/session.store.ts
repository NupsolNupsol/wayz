import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { create } from 'zustand'

import type { EngineKind, Me } from '@/types'

const TOKEN_KEY = 'lockerflow.token'

/**
 * SecureStore is a native keychain; on web it does not exist, so the browser build falls back
 * to localStorage. Only the dev/web preview takes that path — devices always use the keychain.
 */
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
  /** False until the stored token has been read back from the device. */
  ready: boolean
  restore: () => Promise<void>
  signIn: (token: string, me: Me) => Promise<void>
  signOut: () => Promise<void>
  setMe: (me: Me) => void
}

/**
 * Who is signed in on this device. The token lives in SecureStore so it survives a restart;
 * everything else is in memory because the server is the source of truth.
 */
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

/** Read outside React — the API client needs the token on every request. */
export const currentToken = () => useSessionStore.getState().token

/** The activities this agent works. Anything not in here is not theirs to sell. */
export const useMyEngines = (): EngineKind[] => useSessionStore((s) => s.me?.engineKinds ?? [])
