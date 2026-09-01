import axios, { AxiosError, type AxiosInstance } from 'axios'

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
