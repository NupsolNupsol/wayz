import { Router } from 'express'
import { authenticate, requireAgent } from '../middlewares/auth.js'
import { incidentController } from '../controllers/incident.controller.js'

const router = Router()
router.use(authenticate, requireAgent)

router.get('/', incidentController.list)
router.post('/', incidentController.create)
router.patch('/:id', incidentController.updateStatus)

export default router
