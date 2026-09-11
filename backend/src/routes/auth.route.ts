import { Router, type Request } from 'express'
import { authenticate } from '../middlewares/auth.js'
import { withPublicLinkTenant } from '../platform/publicLinks.js'
import { hashInviteToken } from '../models/user.model.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { authController } from '../controllers/auth.controller.js'

const router = Router()

router.post('/login', authController.login)
const perInvitation = { windowMs: 60_000, keyOn: (req: Request) => req.params.token ?? '' }

router.get(
  '/invitation/:token',
  rateLimit({ ...perInvitation, max: 20 }),
  withPublicLinkTenant('token', hashInviteToken),
  authController.invitation,
)
router.post(
  '/invitation/:token',
  rateLimit({ ...perInvitation, max: 10 }),
  withPublicLinkTenant('token', hashInviteToken),
  authController.acceptInvitation,
)
router.get('/me', authenticate, authController.me)
router.post('/logout', authenticate, authController.logout)

export default router
