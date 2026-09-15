import axios, { AxiosError, type AxiosInstance } from 'axios'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ApiError } from '@/api/client'

/**
 * The control plane's own session, kept apart from every tenant's.
 *
 * A separate store under a separate key, and a separate axios instance that only ever sends
 * the platform token. The two must not share a credential slot: a super admin signing in
 * should not end a counter agent's shift on the same laptop, and — much more importantly —
 * a tenant session must never be able to reach a control-plane route by accident because
 * one interceptor grabbed whichever token happened to be in the box.
 *
 * The server enforces the same separation with a token audience. This is the client half of
 * that fence, and it holds even when somebody is signed into both at once.
 */
export interface PlatformAdmin {
  id: string
  email: string
  fullName: string
}

interface PlatformSession {
  token: string | null
  admin: PlatformAdmin | null
  /**
   * Light or dark, chosen by the operator and remembered.
   *
   * Kept on the platform's own session rather than shared with a tenant's: somebody may be
   * signed into both on one laptop, and their preference for the control plane is a separate
   * preference. Light by default, because an administration console is read in daylight far
   * more often than it is read at night.
   */
  theme: 'light' | 'dark'
  signIn: (token: string, admin: PlatformAdmin) => void
  signOut: () => void
  toggleTheme: () => void
}

export const usePlatformSession = create<PlatformSession>()(
  persist(
    (set, get) => ({
      token: null,
      admin: null,
      theme: 'light',
      signIn: (token, admin) => set({ token, admin }),
      signOut: () => set({ token: null, admin: null }),
      toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
    }),
    { name: 'lockerflow.platform.session' },
  ),
)

export const platformHttp: AxiosInstance = axios.create({ baseURL: '/api/platform', timeout: 30_000 })

platformHttp.interceptors.request.use((config) => {
  const token = usePlatformSession.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

platformHttp.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; errors?: string[] }>) => {
    const status = error.response?.status ?? 0
    const message = error.response?.data?.message ?? error.message ?? 'Request failed'
    const errors = error.response?.data?.errors
    // A dead platform session signs out of the control plane only — a tenant session open in
    // the same browser is somebody else's work and is left alone.
    if (status === 401) usePlatformSession.getState().signOut()
    return Promise.reject(new ApiError(message, status, errors))
  },
)

export async function unwrapPlatform<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await promise
  return res.data.data
}
