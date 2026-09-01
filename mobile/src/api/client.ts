import { create, isAxiosError } from 'axios'

import { currentToken, useSessionStore } from '@/store/session.store'

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL in .env — a device on the shop floor cannot
 * reach "localhost", so it needs the machine's LAN address (see SETUP_GUIDE.md).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export const api = create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = currentToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // A dead token is worse than no token: clear it so the app can ask for a new one.
    if (error?.response?.status === 401) await useSessionStore.getState().signOut()
    return Promise.reject(error)
  },
)

/** The API answers with { success, data }; screens only ever want the data. */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<{ data: T }>(url, { params })
  return data.data
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<{ data: T }>(url, body ?? {})
  return data.data
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<{ data: T }>(url, body ?? {})
  return data.data
}

/** Turns an axios failure into the message the API actually sent. */
export function apiMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError(error)) {
    const payload = error.response?.data as { message?: string; errors?: string[] } | undefined
    if (payload?.errors?.length) return payload.errors.join(' ')
    if (payload?.message) return payload.message
    if (error.code === 'ECONNABORTED') return 'The server took too long to answer.'
    if (!error.response) return 'No connection to the server.'
  }
  return fallback
}
