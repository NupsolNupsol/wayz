import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { FLOOR_LEADS, SELLING_STAFF } from '../domain/roles.js'
import { shiftController } from '../controllers/shift.controller.js'

const router = Router()
router.use(authenticate)

const carriesCash = requireRole(...SELLING_STAFF, 'DELIVERY_AGENT')

router.get('/current', carriesCash, shiftController.current)
router.post('/open', carriesCash, shiftController.open)
router.post('/:id/blind-count', carriesCash, shiftController.blindCount)
router.post('/:id/resolve', requireRole(...FLOOR_LEADS), shiftController.resolve)

router.post('/:id/force-close', requireRole(...FLOOR_LEADS), shiftController.forceClose)

export default router
