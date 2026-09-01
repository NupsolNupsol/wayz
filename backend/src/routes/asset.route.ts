import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { assetController } from '../controllers/asset.controller.js'

const router = Router()

/** One estate, read by everyone who works it; changed only by the three roles that own it. */
const readers = requireRole('MANAGER', 'TENANT_ADMIN', 'HR', 'AGENT')
const owners = requireRole('MANAGER', 'TENANT_ADMIN', 'HR')

router.use(authenticate)

router.get('/types', readers, assetController.types)
router.post('/types', owners, assetController.createType)
router.get('/types/:id', readers, assetController.typeDetail)
router.patch('/types/:id', owners, assetController.updateType)
router.delete('/types/:id', owners, assetController.removeType)
router.post('/types/:id/units', owners, assetController.addUnits)
router.patch('/types/:id/price', owners, assetController.price)

router.get('/units/:id', readers, assetController.unit)
router.patch('/units/:id', owners, assetController.updateUnit)
router.delete('/units/:id', owners, assetController.removeUnit)

export default router
