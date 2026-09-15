import { Router } from 'express'
import { rateLimit } from '../middlewares/rateLimit.js'
import { trackingController } from '../controllers/tracking.controller.js'
import { versionController } from '../controllers/version.controller.js'
import { publicTenantController } from '../controllers/platform.controller.js'
import { withPublicLinkTenant } from '../platform/publicLinks.js'

const router = Router()

router.use(rateLimit({ windowMs: 60_000, max: 120 }))

router.get('/tracking/:id', withPublicLinkTenant('id'), trackingController.get)
router.get('/invoice/:token', withPublicLinkTenant('token'), trackingController.invoicePdf)

// A tenant's own login page, before any credential exists: its name and its colours only.
// The workspaces to choose between at the platform's own door. Empty unless this deployment
// has declared itself a demonstration — see the controller for why enumeration is gated.
router.get('/workspaces', publicTenantController.directory)
router.get('/tenants/:slug', publicTenantController.bySlug)

router.get('/versions', versionController.list)
router.get('/versions/:id', versionController.detail)
router.post('/versions/:id/changes/:index/check', versionController.check)
router.post('/versions/:id/changes/:index/issue', versionController.report)

export default router
