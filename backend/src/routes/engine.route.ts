import { Router } from 'express'
import { authenticate } from '../middlewares/auth.js'
import { engineController } from '../controllers/engine.controller.js'

const router = Router()
router.use(authenticate)

router.get('/workflows', engineController.workflows)
router.get('/incident-types', engineController.incidentTypes)
router.get('/workflows/:kind', engineController.workflow)

export default router
