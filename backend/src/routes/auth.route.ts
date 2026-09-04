import { Router, type Request } from 'express'
import { authenticate } from '../middlewares/auth.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { authController } from '../controllers/auth.controller.js'

const router = Router()

router.post('/login', authController.login)
const perInvitation = { windowMs: 60_000, keyOn: (req: Request) => req.params.token ?? '' }

router.get('/invitation/:token', rateLimit({ ...perInvitation, max: 20 }), authController.invitation)
router.post('/invitation/:token', rateLimit({ ...perInvitation, max: 10 }), authController.acceptInvitation)
router.get('/me', authenticate, authController.me)
router.post('/logout', authenticate, authController.logout)

export default router
