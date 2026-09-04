import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { tillController } from '../controllers/till.controller.js'
import { BACK_OFFICE, FLOOR_LEADS, SELLING_STAFF } from '../domain/roles.js'

const router = Router()

router.use(authenticate, requireRole(...SELLING_STAFF, ...FLOOR_LEADS))

router.get('/overview', tillController.overview)
router.get('/queue', tillController.queue)
router.get('/transactions', tillController.transactions)
router.get('/drawer', tillController.drawer)
router.post('/drawer/movement', tillController.movement)

router.post(
  '/payments/:id/refund',
  requireRole(...BACK_OFFICE),
  tillController.refund,
)

export default router
