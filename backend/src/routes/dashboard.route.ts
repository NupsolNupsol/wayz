import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { DESK_STAFF } from '../domain/roles.js'
import { dashboardController } from '../controllers/dashboard.controller.js'

const router = Router()
router.use(authenticate, requireRole(...DESK_STAFF))

router.get('/stats', dashboardController.stats)

export default router
