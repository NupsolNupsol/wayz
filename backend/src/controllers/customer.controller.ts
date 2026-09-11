import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { createCustomer, getCustomer, listCustomers } from '../services/customer.service.js'

/**
 * Registering somebody takes three things, not two.
 *
 * The desk hands over a vehicle or holds a bag against a name, and a name and a number alone are
 * not an identity — so the card number is asked for at registration and required here, where it
 * cannot be skipped by a client that forgot to ask. Format is deliberately not policed: the cards
 * this platform sees are national ids, residency permits and passports, and a regex written
 * around one of them would turn the other two away at the counter.
 */
const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(3),
  email: z.string().email().optional(),
  nationalId: z.string().trim().min(4, 'A national ID or card number is needed to register a customer.'),
})

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
