import { Router } from 'express'
import { authenticate, requireAgent } from '../middlewares/auth.js'
import { bookingController } from '../controllers/booking.controller.js'

const router = Router()
router.use(authenticate, requireAgent)

router.post('/', bookingController.create)
router.get('/', bookingController.list)
router.get('/:id', bookingController.get)
router.get('/:id/order', bookingController.order)
router.get('/:id/transitions', bookingController.transitions)
router.post('/:id/pay', bookingController.pay)
router.post('/:id/reserve', bookingController.reserve)
router.post('/:id/reassign', bookingController.reassign)
router.post('/:id/scan-out', bookingController.scanOut)
router.post('/:id/transition', bookingController.transition)

router.get('/:id/refund', bookingController.refundPosition)
router.post('/:id/refund', bookingController.refund)

router.post('/:id/verification/send', bookingController.sendVerification)
router.post('/:id/verification/confirm', bookingController.confirmVerification)
router.get('/:id/verification/evidence/:evidenceId', bookingController.verificationEvidence)

export default router
