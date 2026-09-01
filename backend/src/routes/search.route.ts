import { Router } from 'express'
import { authenticate } from '../middlewares/auth.js'
import { searchController } from '../controllers/search.controller.js'

const router = Router()
router.use(authenticate)

router.get('/', searchController.search)

export default router
