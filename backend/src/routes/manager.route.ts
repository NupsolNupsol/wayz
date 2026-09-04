import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { BACK_OFFICE, FLOOR_LEADS } from '../domain/roles.js'
import { managerController } from '../controllers/manager.controller.js'

const router = Router()

router.use(authenticate, requireRole(...FLOOR_LEADS))

const configure = requireRole(...BACK_OFFICE)

router.get('/overview', managerController.overview)
router.get('/live-sessions', managerController.liveSessions)

router.get('/rentals', managerController.rentals)
router.get('/rentals/:id', managerController.rentalDetail)

router.get('/customers', managerController.customers)
router.get('/customers/:id', managerController.customerDetail)

router.get('/org', managerController.org)
router.post('/org/sites', configure, managerController.createSite)
router.patch('/org/sites/:id', configure, managerController.updateSite)
router.post('/org/stations', configure, managerController.createStation)
router.patch('/org/stations/:id', configure, managerController.updateStation)
router.post('/org/kiosks', configure, managerController.createKiosk)
router.patch('/org/kiosks/:id', configure, managerController.updateKiosk)
router.delete('/org/kiosks/:id', configure, managerController.removeKiosk)

router.get('/payments', managerController.payments)

router.get('/incidents', managerController.incidents)
router.patch('/incidents/:id', managerController.updateIncident)
router.get('/shifts', managerController.shifts)
router.get('/shifts/:id', managerController.shift)

router.get('/staff', managerController.staff)
router.post('/staff', configure, managerController.createStaff)
router.patch('/staff/:id', configure, managerController.updateStaff)
router.post('/staff/:id/password', configure, managerController.resetStaffPassword)
router.post('/staff/:id/invite', configure, managerController.reinviteStaff)

router.get('/settings', managerController.settings)
router.patch('/settings', configure, managerController.updateSettings)

router.get('/reports/revenue', managerController.reportRevenue)
router.get('/reports/agents', managerController.reportAgents)
router.get('/reports/occupancy', managerController.reportOccupancy)
router.get('/reports/rentals', managerController.reportRentals)
router.get('/reports/customers', managerController.reportCustomers)
router.get('/reports/export/:kind', managerController.exportReport)

router.get('/activity', managerController.activity)

export default router
