import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { deliveryController } from '../controllers/delivery.controller.js'

const router = Router()
router.use(authenticate)

const requireCourier = requireRole('DELIVERY_AGENT')
router.get('/courier/board', requireCourier, deliveryController.board)
router.post('/courier/:id/transition', requireCourier, deliveryController.courierTransition)
router.post('/courier/:id/collect', requireCourier, deliveryController.courierCollect)
router.post('/courier/:id/collect-stop', requireCourier, deliveryController.collectStop)

const requireKiosk = requireRole('AGENT')
router.post('/', requireKiosk, deliveryController.create)
router.get('/station', requireKiosk, deliveryController.station)
router.get('/customer-bags/:bookingId', requireKiosk, deliveryController.customerBags)
router.post('/station/:id/transition', requireKiosk, deliveryController.kioskTransition)

router.get('/:id', deliveryController.detail)

export default router
