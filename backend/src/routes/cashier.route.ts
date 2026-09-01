import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { cashierController } from '../controllers/cashier.controller.js'

const router = Router()
router.use(authenticate, requireRole('CASHIER', 'AGENT'))

router.get('/overview', cashierController.overview)
router.get('/queue', cashierController.queue)
router.get('/transactions', cashierController.transactions)
router.get('/drawer', cashierController.drawer)
router.post('/drawer/movement', cashierController.movement)

router.post('/payments/:id/refund', requireRole('CASHIER', 'MANAGER'), cashierController.refund)

export default router
