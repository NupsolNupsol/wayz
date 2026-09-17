import axios, { AxiosError, type AxiosInstance } from 'axios';

export class ApiError extends Error {
  status: number;
  errors?: string[];
  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.name = 'ApiError';
  }
}

let tokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function configureAuth(getter: () => string | null, unauthorizedHandler: () => void) {
  tokenGetter = getter;
  onUnauthorized = unauthorizedHandler;
}

export const http: AxiosInstance = axios.create({ baseURL: '/api', timeout: 15_000 });

http.interceptors.request.use((config) => {
  const token = tokenGetter();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * The requests where a 401 is an answer, not an expired session.
 *
 * Signing in with the wrong password returns 401. Treating that as "your session has ended"
 * ran the global sign-out handler on somebody who had never been signed in — which tore down
 * the tenant's branding and turned a mistyped password on WIQAR's page into WAYZ's turquoise.
 * A failed attempt to start a session cannot end one.
 */
const AUTHENTICATION_ATTEMPTS = [/\/auth\/login$/, /\/auth\/invitation\//];

const isAuthenticationAttempt = (url: string | undefined): boolean =>
  !!url && AUTHENTICATION_ATTEMPTS.some((r) => r.test(url.split('?')[0]));

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; errors?: string[] }>) => {
    const status = error.response?.status ?? 0;
    const message = error.response?.data?.message ?? error.message ?? 'Request failed';
    const errors = error.response?.data?.errors;
    if (status === 401 && !isAuthenticationAttempt(error.config?.url)) onUnauthorized();
    return Promise.reject(new ApiError(message, status, errors));
  }
);

export async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}
