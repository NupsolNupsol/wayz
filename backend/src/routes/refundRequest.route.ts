import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { refundRequestController } from '../controllers/refundRequest.controller.js'
import { REFUND_APPROVERS } from '../services/refundRequest.service.js'
import { DESK_STAFF, FLOOR_LEADS } from '../domain/roles.js'

const router = Router()

router.use(authenticate, requireRole(...DESK_STAFF, ...FLOOR_LEADS, ...REFUND_APPROVERS))

router.get('/', refundRequestController.list)
router.post('/:id/review', requireRole(...REFUND_APPROVERS), refundRequestController.review)

export default router
