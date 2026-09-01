import { http, unwrap } from './client'
import type { Customer } from './types'

export const customerApi = {
  list: (q?: string) => unwrap<Customer[]>(http.get('/customers', { params: q ? { q } : {} })),
  get: (id: string) => unwrap<Customer>(http.get(`/customers/${id}`)),
  create: (data: { name: string; phone: string; email?: string }) => unwrap<Customer>(http.post('/customers', data)),
}
