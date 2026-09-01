import { Router } from 'express'
import { authenticate, requireAgent } from '../middlewares/auth.js'
import { dashboardController } from '../controllers/dashboard.controller.js'

const router = Router()
router.use(authenticate, requireAgent)

router.get('/stats', dashboardController.stats)

export default router
