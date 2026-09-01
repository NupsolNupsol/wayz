import { QueryClient } from '@tanstack/react-query'

/**
 * Shop-floor defaults: a handheld drops off wifi constantly, so a failed read is retried a
 * couple of times, while a write is never retried behind the operator's back.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
