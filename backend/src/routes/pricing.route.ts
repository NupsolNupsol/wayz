import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { BACK_OFFICE, FLOOR_LEADS } from '../domain/roles.js'
import { managerController } from '../controllers/manager.controller.js'

const router = Router()

router.use(authenticate, requireRole(...FLOOR_LEADS, 'HR'))

const setsPrices = requireRole(...BACK_OFFICE, 'HR')

router.get('/', managerController.pricing)
router.post('/products', setsPrices, managerController.createProduct)
router.patch('/products/:id', setsPrices, managerController.updateProduct)

export default router
