import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { FLOOR_LEADS, SELLING_STAFF } from '../domain/roles.js'
import { bookingController } from '../controllers/booking.controller.js'

const router = Router()

router.use(authenticate, requireRole(...SELLING_STAFF, ...FLOOR_LEADS))

const desk = requireRole(...SELLING_STAFF)

router.get('/', bookingController.list)
router.get('/:id', bookingController.get)
router.get('/:id/order', bookingController.order)
router.get('/:id/invoice', bookingController.invoice)
router.post('/:id/invoice/whatsapp', bookingController.whatsappInvoice)
router.get('/:id/refund', bookingController.refundPosition)
router.post('/:id/refund', bookingController.refund)

router.post('/', desk, bookingController.create)
router.get('/:id/transitions', desk, bookingController.transitions)
router.post('/:id/pay', desk, bookingController.pay)
router.post('/:id/settle', desk, bookingController.settle)
router.post('/:id/reserve', desk, bookingController.reserve)
router.post('/:id/reassign', desk, bookingController.reassign)
router.post('/:id/return', desk, bookingController.returnHere)
router.post('/:id/scan-out', desk, bookingController.scanOut)
router.post('/:id/transition', desk, bookingController.transition)

router.post('/:id/verification/send', desk, bookingController.sendVerification)
router.post('/:id/verification/confirm', desk, bookingController.confirmVerification)
router.get('/:id/verification/evidence/:evidenceId', bookingController.verificationEvidence)

export default router
