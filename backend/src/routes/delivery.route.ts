import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { deliveryController } from '../controllers/delivery.controller.js'

const router = Router()
router.use(authenticate)

const requireCourier = requireRole('DELIVERY_AGENT')
router.get('/courier/board', requireCourier, deliveryController.board)
router.post('/courier/:id/transition', requireCourier, deliveryController.courierTransition)

const requireKiosk = requireRole('AGENT')
router.post('/', requireKiosk, deliveryController.create)
router.get('/station', requireKiosk, deliveryController.station)
router.post('/station/:id/transition', requireKiosk, deliveryController.kioskTransition)

router.get('/:id', deliveryController.detail)

export default router
