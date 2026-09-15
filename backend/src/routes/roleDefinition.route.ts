import { Router } from 'express'

import { authenticate, requireRole } from '../middlewares/auth.js'
import { roleDefinitionController } from '../controllers/roleDefinition.controller.js'

/**
 * Jobs, as a tenant defines them.
 *
 * Reading is open to anybody signed in: an employee form has to name the jobs it offers, and
 * a person's own screens have to say what their job is called. Defining them is the work of
 * whoever runs the company.
 */
const router = Router()

router.use(authenticate)

router.get('/vocabulary', roleDefinitionController.vocabulary)
router.get('/', roleDefinitionController.list)
router.get('/:key/assignable', roleDefinitionController.assignable)

const owners = requireRole('TENANT_ADMIN', 'PROJECT_MANAGER')

router.post('/', owners, roleDefinitionController.create)
router.patch('/:key', owners, roleDefinitionController.update)
router.delete('/:key', owners, roleDefinitionController.remove)

export default router
