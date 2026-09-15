import { Router } from 'express'

import { platformController } from '../controllers/platform.controller.js'
import { authenticatePlatform } from '../platform/platformAuth.js'
import { platformKnowledgeController } from '../controllers/platformKnowledge.controller.js'

/**
 * The control plane's own API, above every tenant.
 *
 * Nothing here enters a tenant database. These routes act on the registry — which companies
 * exist, what they are called, what they may do, whether they are live — and a request that
 * quietly landed inside somebody's operational data would defeat the whole separation.
 *
 * `authenticatePlatform` is deliberately a different middleware from `authenticate`, not a
 * role check inside the same one: a tenant's own administrator is the most powerful person
 * in their company and still has no business here, and the two credentials are different
 * kinds of thing rather than the same kind with a flag.
 */
const router = Router()

// The only door: no session required, because this is where a session begins. There is no
// signup beside it and never will be — platform administrators are made by whoever holds
// the server's environment, and by nobody else.
router.post('/auth/login', platformController.signIn)

router.use(authenticatePlatform)

router.get('/auth/me', platformController.me)
router.get('/vocabulary', platformController.vocabulary)

router.get('/tenants', platformController.tenants)
router.post('/tenants', platformController.create)
router.get('/tenants/:id', platformController.tenant)
router.patch('/tenants/:id', platformController.update)
router.get('/tenants/:id/structure', platformController.structure)
router.post('/tenants/:id/provision', platformController.retryProvisioning)
router.post('/tenants/:id/lifecycle', platformController.lifecycle)
// The one destructive action: suspended first, handle typed back, recorded in the audit.
router.delete('/tenants/:id', platformController.remove)

router.get('/audit', platformController.audit)

/*
 * The knowledge base behind the employee AI assistant.
 *
 * Here rather than under a tenant because choosing *which company* a document belongs to is
 * a control-plane decision, and because global LockerFlow documentation belongs to no tenant
 * at all. The documents and their vectors live in the learning-ai service; these routes are
 * the authenticated, audited way in — see controllers/platformKnowledge.controller.ts.
 */
router.get('/knowledge/vocabulary', platformKnowledgeController.vocabulary)
router.get('/knowledge/health', platformKnowledgeController.health)
router.get('/knowledge/analytics', platformKnowledgeController.analytics)
router.get('/knowledge/documents', platformKnowledgeController.list)
router.post('/knowledge/documents', platformKnowledgeController.create)
router.get('/knowledge/documents/:id', platformKnowledgeController.detail)
router.patch('/knowledge/documents/:id', platformKnowledgeController.update)
router.post('/knowledge/documents/:id/reindex', platformKnowledgeController.reindex)
router.delete('/knowledge/documents/:id', platformKnowledgeController.remove)

/*
 * The platform describing itself: what exists, whether it is well, and how it has grown.
 *
 * All three read the registry and each tenant's *shape* — never a tenant's operational
 * records. See `operations.service.ts`.
 */
router.get('/overview', platformController.overview)
router.get('/health', platformController.health)
router.get('/reports', platformController.reports)

/*
 * Platform administrators. Creating one requires already being one — there is no public
 * registration for an account that can reach every tenant on the installation.
 */
router.get('/admins', platformController.admins)
router.post('/admins', platformController.createAdmin)
router.post('/admins/:id/active', platformController.setAdminActive)

export default router
