import { Router } from 'express';

import { authenticate } from '../middlewares/auth.js';
import { procurementController } from '../controllers/procurement.controller.js';

/**
 * Purchase orders — §8.2.
 *
 * No `requireRole` gate here for the same reason the transfer routes have none: who may
 * approve is **configuration**, and it changes with what the order costs. A role gate in this
 * file would be a second answer that contradicts the configured one and cannot be changed
 * without a release.
 */
const router = Router();

router.use(authenticate);

router.get('/policy', procurementController.policy);
router.get('/', procurementController.list);
router.post('/', procurementController.raise);
router.post('/:id/submit', procurementController.submit);
router.post('/:id/approve', procurementController.approve);
router.post('/:id/reject', procurementController.reject);
router.post('/:id/receive', procurementController.receive);
router.post('/:id/cancel', procurementController.cancel);

export default router;
