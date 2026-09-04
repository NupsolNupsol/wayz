import { Router } from 'express'
import { authenticate, requireHr } from '../middlewares/auth.js'
import { hrController } from '../controllers/hr.controller.js'

const router = Router()
router.use(authenticate, requireHr)

router.get('/overview', hrController.overview)
router.get('/expenses', hrController.expenses)
router.post('/expenses', hrController.createExpense)
router.post('/expenses/:id/void', hrController.voidExpense)
router.get('/seasons', hrController.seasons)
router.post('/seasons', hrController.createSeason)
router.get('/seasons/:id', hrController.season)
router.post('/seasons/payroll', hrController.chargePayroll)

router.get('/shift-window', hrController.shiftWindow)
router.patch('/shift-window', hrController.setShiftWindow)
router.get('/hours', hrController.hours)
router.get('/audit', hrController.peopleAudit)

export default router
