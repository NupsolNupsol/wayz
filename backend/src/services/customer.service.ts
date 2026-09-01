import { Customer } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'

export function listCustomers(tenantId: string, query?: string) {
  const q: Record<string, unknown> = { tenantId }
  if (query?.trim()) {
    const rx = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    q.$or = [{ name: rx }, { phone: rx }]
  }
  return Customer.find(q).sort({ createdAt: -1 }).limit(100).lean()
}

export async function getCustomer(tenantId: string, id: string) {
  const c = await Customer.findOne({ _id: id, tenantId }).lean()
  if (!c) throw ApiError.notFound('Customer not found.')
  return c
}

export async function createCustomer(tenantId: string, data: { name: string; phone: string; email?: string }) {
  return Customer.create({
    _id: await nextId('customer'),
    tenantId,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || undefined,
  })
}
