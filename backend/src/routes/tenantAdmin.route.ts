import { Router } from 'express'
import { authenticate, requireRole, requireTenantAdmin } from '../middlewares/auth.js'
import { BACK_OFFICE } from '../domain/roles.js'
import { tenantAdminController } from '../controllers/tenantAdmin.controller.js'
import { versionController } from '../controllers/version.controller.js'

const router = Router()

router.use(authenticate)

const owner = requireTenantAdmin

router.get('/overview', owner, tenantAdminController.overview)
router.get('/people', owner, tenantAdminController.people)
router.get('/audit', owner, tenantAdminController.audit)
router.get('/isolation', owner, tenantAdminController.isolation)
router.get('/station-map', owner, tenantAdminController.stationMap)
router.patch('/station-map', owner, tenantAdminController.saveStationMap)

router.post('/versions', owner, versionController.create)
router.patch('/versions/:id', owner, versionController.update)
router.delete('/versions/:id', owner, versionController.remove)
router.patch('/company', owner, tenantAdminController.updateCompany)

router.get('/rules', requireRole(...BACK_OFFICE), tenantAdminController.rules)
router.patch('/rules', requireRole(...BACK_OFFICE), tenantAdminController.updateRules)

export default router
