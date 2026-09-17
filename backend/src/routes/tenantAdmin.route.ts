import { Router } from 'express';
import { authenticate, requireRole, requireTenantAdmin } from '../middlewares/auth.js';
import { BACK_OFFICE } from '../domain/roles.js';
import {
  activityCatalogueController,
  tenantAdminController,
} from '../controllers/tenantAdmin.controller.js';
import { versionController } from '../controllers/version.controller.js';
import { voucherController } from '../controllers/voucher.controller.js';

const router = Router();

router.use(authenticate);

const owner = requireTenantAdmin;

router.get('/overview', owner, tenantAdminController.overview);
router.get('/people', owner, tenantAdminController.people);
router.get('/audit', owner, tenantAdminController.audit);
router.get('/isolation', owner, tenantAdminController.isolation);
router.get('/station-map', owner, tenantAdminController.stationMap);
router.patch('/station-map', owner, tenantAdminController.saveStationMap);

router.post('/versions', owner, versionController.create);
router.patch('/versions/:id', owner, versionController.update);
router.delete('/versions/:id', owner, versionController.remove);
router.patch('/company', owner, tenantAdminController.updateCompany);

router.get('/vouchers', requireRole(...BACK_OFFICE), voucherController.list);
router.post('/vouchers', owner, voucherController.create);
router.get('/vouchers/:id/codes', requireRole(...BACK_OFFICE), voucherController.codes);
router.post('/vouchers/:id/stop', owner, voucherController.stop);

/*
 * The activities this organisation runs.
 *
 * Reading the catalogue is open to the back office, because the employee form and the estate
 * screens need to know what is adopted. Changing it is the administrator's alone — adopting an
 * activity is a decision about what the company sells.
 */
router.get('/activities', requireRole(...BACK_OFFICE), activityCatalogueController.list);
router.put('/activities', owner, activityCatalogueController.adopt);

router.get('/rules', requireRole(...BACK_OFFICE), tenantAdminController.rules);
router.patch('/rules', requireRole(...BACK_OFFICE), tenantAdminController.updateRules);

export default router;
