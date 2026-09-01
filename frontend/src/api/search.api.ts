import { http, unwrap } from './client'

export interface SearchHit {
  kind: 'BOOKING' | 'CUSTOMER' | 'PAYMENT' | 'TRANSACTION'
  id: string
  label: string
  sublabel: string
}

export const searchApi = {
  search: (q: string) => unwrap<SearchHit[]>(http.get('/search', { params: { q } })),
}
