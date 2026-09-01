import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { acceptInvitation, buildMe, login, readInvitation } from '../services/auth.service.js'

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

  me: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await buildMe(req.auth!.sub) })
  }),
}
