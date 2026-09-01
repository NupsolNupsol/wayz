import { useQuery } from '@tanstack/react-query'

import { api } from '@/api/client'

interface Health {
  status: string
  ts: number
}

/**
 * Proves the device can reach the API. Health sits outside the { success, data } envelope,
 * so it reads the body directly.
 */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<Health> => {
      const { data } = await api.get<Health>('/health')
      return data
    },
    retry: 0,
    staleTime: 10_000,
  })
}
