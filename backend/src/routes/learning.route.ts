import { Router } from 'express'

import { authenticate } from '../middlewares/auth.js'
import { learningController } from '../controllers/learning.controller.js'

/**
 * The employee learning assistant.
 *
 * No `requireRole` anywhere: every member of staff may ask how to do their own job, and the
 * *answer* is what is filtered — the AI service only ever retrieves documents this tenant
 * owns and this role is allowed to read. Gating the route by role would be the wrong fence
 * in the wrong place, and would still leave the retrieval filter as the thing that matters.
 *
 * `authenticate` puts the request inside the caller's tenant, which is where the tenant in
 * the signed service token comes from. There is no route here that names a tenant.
 */
const router = Router()

router.use(authenticate)

router.get('/capability', learningController.capability)

router.post('/chat', learningController.ask)
router.post('/speech', learningController.speak)
router.post('/feedback', learningController.feedback)
router.post('/events/video-click', learningController.videoClick)

router.get('/onboarding', learningController.onboarding)
router.post('/onboarding', learningController.saveOnboarding)

export default router
