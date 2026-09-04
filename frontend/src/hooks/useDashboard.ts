import { useQuery } from '@tanstack/react-query'
import { dashboardApi, engineApi } from '../api/misc.api'
import { qk } from './queryKeys'

export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: dashboardApi.stats, refetchInterval: 15_000 })

export const useWorkflows = () => useQuery({ queryKey: qk.workflows, queryFn: engineApi.workflows, staleTime: Infinity })
