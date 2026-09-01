import { Router } from 'express'
import { authenticate, requireAgent, requireRole } from '../middlewares/auth.js'
import { shiftController } from '../controllers/shift.controller.js'

const router = Router()
router.use(authenticate)

router.get('/current', requireAgent, shiftController.current)
router.post('/open', requireAgent, shiftController.open)
router.post('/:id/blind-count', requireAgent, shiftController.blindCount)
router.post('/:id/resolve', requireRole('MANAGER', 'TENANT_ADMIN'), shiftController.resolve)

export default router
