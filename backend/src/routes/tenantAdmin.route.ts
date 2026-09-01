import { Router } from 'express'
import { authenticate, requireTenantAdmin } from '../middlewares/auth.js'
import { tenantAdminController } from '../controllers/tenantAdmin.controller.js'

const router = Router()
router.use(authenticate, requireTenantAdmin)

router.get('/overview', tenantAdminController.overview)
router.get('/people', tenantAdminController.people)
router.get('/audit', tenantAdminController.audit)
router.get('/isolation', tenantAdminController.isolation)
router.patch('/company', tenantAdminController.updateCompany)

export default router
