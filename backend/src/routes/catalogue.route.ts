import { Router } from 'express'
import { authenticate, requireAgent } from '../middlewares/auth.js'
import { catalogueController } from '../controllers/catalogue.controller.js'

const router = Router()
router.use(authenticate, requireAgent)

router.get('/products', catalogueController.products)
router.get('/asset-types', catalogueController.assetTypes)
router.get('/units', catalogueController.units)
router.post('/packing-suggestions', catalogueController.packingSuggestions)

export default router
