import { useQuery } from '@tanstack/react-query'
import { publicApi } from '../api/public.api'
import { qk } from './queryKeys'

export const usePublicTracking = (id: string | undefined) =>
  useQuery({
    queryKey: qk.tracking(id ?? ''),
    queryFn: () => publicApi.tracking(id!),
    enabled: !!id,
    refetchInterval: 20_000,
    retry: false,
  })
