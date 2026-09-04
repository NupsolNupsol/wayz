import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { assetController } from '../controllers/asset.controller.js'
import { ESTATE_OWNERS, ESTATE_READERS } from '../domain/roles.js'

const router = Router()

const readers = requireRole(...ESTATE_READERS)
const owners = requireRole(...ESTATE_OWNERS)

router.use(authenticate)

router.get('/types', readers, assetController.types)
router.post('/types', owners, assetController.createType)
router.get('/types/:id', readers, assetController.typeDetail)
router.patch('/types/:id', owners, assetController.updateType)
router.delete('/types/:id', owners, assetController.removeType)
router.post('/types/:id/units', owners, assetController.addUnits)
router.patch('/types/:id/price', owners, assetController.price)

router.get('/units/:id', readers, assetController.unit)
router.get('/units/:id/return-position', readers, assetController.returnPosition)
router.patch('/units/:id', owners, assetController.updateUnit)
router.delete('/units/:id', owners, assetController.removeUnit)

export default router
