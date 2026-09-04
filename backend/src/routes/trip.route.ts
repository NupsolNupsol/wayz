import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { FLOOR_LEADS } from '../domain/roles.js'
import { tripController } from '../controllers/trip.controller.js'

const router = Router()
router.use(authenticate, requireRole('AGENT', 'CHIEF_CAPTAIN', ...FLOOR_LEADS))

const desk = requireRole('AGENT', ...FLOOR_LEADS)
const captain = requireRole('CHIEF_CAPTAIN')

router.get('/waiting', desk, tripController.waiting)
router.post('/plan', desk, tripController.plan)

router.get('/', tripController.board)
router.get('/:id', tripController.detail)

router.post('/:id/claim', captain, tripController.claim)
router.post('/:id/start', captain, tripController.start)
router.post('/:id/route', captain, tripController.route)
router.post('/:id/stops', captain, tripController.stop)
router.post('/:id/complete', captain, tripController.complete)

export default router
