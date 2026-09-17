import { Router } from 'express';

import { authenticatePlatform } from '../middlewares/auth.js';
import { platformController } from '../controllers/platform.controller.js';

/**
 * The platform console.
 *
 * Every route here runs on a platform session and inside no organisation. That is the one
 * genuine exception to the scoping rule the rest of the API depends on, so it is kept in one
 * router behind one middleware rather than spread across the others — a reader looking for
 * "what can see across companies" has exactly this file to read.
 *
 * `authenticatePlatform` is applied once, at the top, so a route added below cannot forget it.
 */
const router = Router();

router.use(authenticatePlatform);

router.get('/me', platformController.me);

/* What the platform can do at all, and who is doing it. */
router.get('/catalogue', platformController.catalogue);
router.get('/assistant', platformController.assistant);

/* The companies. */
router.get('/organisations', platformController.organisations);
router.post('/organisations', platformController.createOrganisation);
router.patch('/organisations/:id', platformController.updateOrganisation);

/* Reporting across them. */
router.get('/report', platformController.report);

/* What the assistant has been given to read. */
router.get('/knowledge', platformController.knowledge);
router.post('/knowledge', platformController.uploadKnowledge);
router.post('/knowledge/:id/reindex', platformController.reindexKnowledge);
router.delete('/knowledge/:id', platformController.removeKnowledge);

export default router;
