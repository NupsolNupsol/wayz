import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { manualSaleController } from '../controllers/manualSale.controller.js'

const router = Router()

router.use(authenticate, requireRole('ACCOUNTANT', 'SUPERVISOR', 'MANAGER', 'PROJECT_MANAGER', 'TENANT_ADMIN'))

router.get('/', manualSaleController.list)
router.post('/', manualSaleController.create)

router.post('/:id/review', requireRole('TENANT_ADMIN'), manualSaleController.review)

export default router
