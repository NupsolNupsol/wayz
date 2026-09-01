import { useQuery } from '@tanstack/react-query'
import { searchApi } from '../api/search.api'

export function useSearch(query: string, enabled = true) {
  const q = query.trim()
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => searchApi.search(q),
    enabled: enabled && q.length >= 2,
    staleTime: 15_000,
  })
}
