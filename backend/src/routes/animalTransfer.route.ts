import { Router } from 'express'

import { authenticate } from '../middlewares/auth.js'
import { animalTransferController } from '../controllers/animalTransfer.controller.js'

/**
 * Inter-location animal transfers — §7.4.
 *
 * No `requireRole` here, deliberately. Who may raise, approve, drive and receive is
 * **configuration** — §7.4 and §11.2 name four different approving roles with no overlap, so
 * the organisation decides and the service enforces whatever it decided. A role gate in this
 * file would be a second, contradicting answer that nobody could change without a release.
 *
 * Authentication is still required: every step records who took it, because §7.4 wants a full
 * log with the approver's identity on it.
 */
const router = Router()

router.use(authenticate)

router.get('/policy', animalTransferController.policy)
router.get('/', animalTransferController.list)
router.post('/', animalTransferController.raise)
router.post('/:id/approve', animalTransferController.approve)
router.post('/:id/reject', animalTransferController.reject)
router.post('/:id/depart', animalTransferController.depart)
router.post('/:id/receive', animalTransferController.receive)
router.post('/:id/cancel', animalTransferController.cancel)

export default router
