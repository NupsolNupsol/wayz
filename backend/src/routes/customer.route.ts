import { Router } from 'express'
import { authenticate, requireAgent } from '../middlewares/auth.js'
import { customerController } from '../controllers/customer.controller.js'

const router = Router()
router.use(authenticate, requireAgent)

router.get('/', customerController.list)
router.get('/:id', customerController.get)
router.post('/', customerController.create)

export default router
