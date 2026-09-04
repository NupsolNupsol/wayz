import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/auth.api'
import { qk } from './queryKeys'

export const useMe = (enabled = true) =>
  useQuery({ queryKey: qk.me, queryFn: authApi.me, enabled, retry: 2, staleTime: 60_000 })
