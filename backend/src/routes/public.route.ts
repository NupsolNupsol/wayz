import { Router } from 'express'
import { rateLimit } from '../middlewares/rateLimit.js'
import { trackingController } from '../controllers/tracking.controller.js'
import { signInController } from '../controllers/signIn.controller.js'
import { versionController } from '../controllers/version.controller.js'
import { withPublicLinkOrg } from '../platform/publicAccess.js'

const router = Router()

router.use(rateLimit({ windowMs: 60_000, max: 120 }))

router.get('/tracking/:id', withPublicLinkOrg('id'), trackingController.get)
router.get('/invoice/:token', withPublicLinkOrg('token'), trackingController.invoicePdf)


/*
 * The demonstration accounts the sign-in page advertises.
 *
 * One list across every organisation, because there is one neutral door. Empty unless this
 * deployment has declared itself a demonstration.
 */
router.get('/demo-logins', signInController.demoLogins)

router.get('/versions', versionController.list)
router.get('/versions/:id', versionController.detail)
router.post('/versions/:id/changes/:index/check', versionController.check)
router.post('/versions/:id/changes/:index/issue', versionController.report)

export default router
