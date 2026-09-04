import { Router } from 'express'
import { rateLimit } from '../middlewares/rateLimit.js'
import { trackingController } from '../controllers/tracking.controller.js'
import { versionController } from '../controllers/version.controller.js'

const router = Router()

router.use(rateLimit({ windowMs: 60_000, max: 120 }))

router.get('/tracking/:id', trackingController.get)
router.get('/invoice/:token', trackingController.invoicePdf)

router.get('/versions', versionController.list)
router.get('/versions/:id', versionController.detail)
router.post('/versions/:id/changes/:index/check', versionController.check)
router.post('/versions/:id/changes/:index/issue', versionController.report)

export default router
