import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { acceptInvitation, buildMe, login, readInvitation, signOut } from '../services/auth.service.js'

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

const acceptSchema = z.object({
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
})

export const authController = {
  login: asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)
    res.json({ success: true, data: await login(email, password) })
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
