import { Router } from 'express'
import { rateLimit } from '../middlewares/rateLimit.js'
import { trackingController } from '../controllers/tracking.controller.js'

const router = Router()

router.use(rateLimit({ windowMs: 60_000, max: 120 }))

router.get('/tracking/:id', trackingController.get)

export default router
