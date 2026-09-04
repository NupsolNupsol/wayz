import { create, isAxiosError } from 'axios'

import { currentToken, useSessionStore } from '@/store/session.store'

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
    if (error?.response?.status === 401) await useSessionStore.getState().signOut()
    return Promise.reject(error)
  },
)

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
