import { Router } from 'express'
import { authenticate } from '../middlewares/auth.js'
import { devClockController } from '../controllers/devClock.controller.js'

const router = Router()

router.use(authenticate)

router.get('/status', devClockController.status)
router.post('/bookings/:id/age', devClockController.age)

export default router
