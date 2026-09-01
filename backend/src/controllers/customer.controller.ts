import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { createCustomer, getCustomer, listCustomers } from '../services/customer.service.js'

const createSchema = z.object({ name: z.string().min(1), phone: z.string().min(3), email: z.string().email().optional() })

export const customerController = {
  list: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: await listCustomers(s.tenantId, req.query.q as string | undefined) })
  }),

  get: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    res.json({ success: true, data: await getCustomer(s.tenantId, req.params.id) })
  }),

  create: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = createSchema.parse(req.body)
    res.status(201).json({ success: true, data: await createCustomer(s.tenantId, body) })
  }),
}
