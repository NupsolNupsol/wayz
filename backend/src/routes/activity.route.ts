import { Router } from 'express'

import { authenticate, requireRole } from '../middlewares/auth.js'
import { activityController, activitySessionController } from '../controllers/activity.controller.js'

/**
 * Activities a tenant defines for itself.
 *
 * Authoring is the tenant administrator's and the manager's job — the two people who decide
 * what their company sells. Reading the published shape is everybody's, because an agent's
 * counter cannot offer an activity it is not allowed to see.
 *
 * The tenant is taken from the request context throughout. There is no route here that
 * accepts a tenant in its body or its query, so no client can author into another company.
 */
const router = Router()

router.use(authenticate)

/** What the counter needs. Published revisions only; no drafts, no history. */
router.get('/published', activityController.published)

/*
 * Selling one.
 *
 * Anybody a tenant has posted to a counter or to the field, because who may actually run a
 * given activity is not a question the platform's base roles can answer — it is decided by
 * the activity's own operator list and by what that person was assigned, both of which are
 * checked in the service. The base role here only keeps authoring and selling apart.
 */
router.post('/sessions', activitySessionController.open)
router.get('/sessions/:id/steps', activitySessionController.steps)
router.post('/sessions/:id/steps', activitySessionController.step)

const authors = requireRole('TENANT_ADMIN', 'PROJECT_MANAGER', 'MANAGER')

router.get('/vocabulary', authors, activityController.vocabulary)
router.get('/', authors, activityController.list)
router.post('/', authors, activityController.create)
router.get('/:id', authors, activityController.detail)
router.patch('/:id', authors, activityController.saveDraft)
router.get('/:id/check', authors, activityController.check)
router.post('/:id/publish', authors, activityController.publish)
router.post('/:id/status', authors, activityController.setStatus)
// Only for one nothing has been sold under. Anything used is archived, never removed.
router.delete('/:id', authors, activityController.remove)

export default router
