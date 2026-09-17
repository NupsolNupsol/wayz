import { create, isAxiosError } from 'axios'
import axios, { AxiosError, type AxiosInstance } from 'axios'

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
export class ApiError extends Error {
  status: number
  errors?: string[]
  constructor(message: string, status: number, errors?: string[]) {
    super(message)
    this.status = status
    this.errors = errors
    this.name = 'ApiError'
  }
}

let tokenGetter: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function configureAuth(getter: () => string | null, unauthorizedHandler: () => void) {
  tokenGetter = getter
  onUnauthorized = unauthorizedHandler
}

export const http: AxiosInstance = axios.create({ baseURL: '/api', timeout: 15_000 })

http.interceptors.request.use((config) => {
  const token = tokenGetter()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; errors?: string[] }>) => {
    const status = error.response?.status ?? 0
    const message = error.response?.data?.message ?? error.message ?? 'Request failed'
    const errors = error.response?.data?.errors
    if (status === 401) onUnauthorized()
    return Promise.reject(new ApiError(message, status, errors))
  },
)

export async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await promise
  return res.data.data
}
