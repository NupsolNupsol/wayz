import { Router } from 'express'
import { authenticate } from '../middlewares/auth.js'
import { notificationController } from '../controllers/notification.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', notificationController.list)
router.post('/read-all', notificationController.readAll)
router.post('/:id/read', notificationController.read)

export default router
