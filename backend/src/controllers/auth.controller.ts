import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { acceptInvitation, buildMe, login, readInvitation, signOut } from '../services/auth.service.js'
import { tenantForLogin } from '../platform/loginDirectory.js'
import { runInTenant } from '../platform/tenantContext.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** A per-tenant login page posts its own slug; without one the directory decides. */
  tenant: z.string().trim().min(1).optional(),
})

const acceptSchema = z.object({
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
})

export const authController = {
  login: asyncHandler(async (req, res) => {
    const { email, password, tenant } = loginSchema.parse(req.body)
    // Sign-in is the one request with no token, so its tenant is resolved here and the
    // whole attempt runs inside that tenant's database.
    const { tenantId } = await tenantForLogin(email, tenant)
    res.json({ success: true, data: await runInTenant(tenantId, () => login(email, password)) })
  }),

  invitation: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await readInvitation(req.params.token) })
  }),

  acceptInvitation: asyncHandler(async (req, res) => {
    const body = acceptSchema.parse(req.body)
    res.json({ success: true, data: await acceptInvitation(req.params.token, body.password, body.confirmPassword) })
  }),

  logout: asyncHandler(async (req, res) => {
    if (!req.auth) throw ApiError.unauthorized()
    res.json({ success: true, data: await signOut(req.auth.tenantId, req.auth.sub) })
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await buildMe(req.auth!.sub) })
  }),
}
