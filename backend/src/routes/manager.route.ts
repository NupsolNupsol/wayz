import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { managerController } from '../controllers/manager.controller.js'

const router = Router()
router.use(authenticate, requireRole('MANAGER', 'TENANT_ADMIN'))

router.get('/overview', managerController.overview)
router.get('/live-sessions', managerController.liveSessions)

router.get('/rentals', managerController.rentals)
router.get('/rentals/:id', managerController.rentalDetail)

router.get('/customers', managerController.customers)
router.get('/customers/:id', managerController.customerDetail)

router.get('/org', managerController.org)
router.post('/org/sites', managerController.createSite)
router.patch('/org/sites/:id', managerController.updateSite)
router.post('/org/stations', managerController.createStation)
router.patch('/org/stations/:id', managerController.updateStation)
router.post('/org/kiosks', managerController.createKiosk)
router.patch('/org/kiosks/:id', managerController.updateKiosk)

router.get('/payments', managerController.payments)

router.get('/incidents', managerController.incidents)
router.patch('/incidents/:id', managerController.updateIncident)
router.get('/shifts', managerController.shifts)

router.get('/staff', managerController.staff)
router.post('/staff', managerController.createStaff)
router.patch('/staff/:id', managerController.updateStaff)
router.post('/staff/:id/password', managerController.resetStaffPassword)
router.post('/staff/:id/invite', managerController.reinviteStaff)

router.get('/pricing', managerController.pricing)
router.post('/pricing/products', managerController.createProduct)
router.patch('/pricing/products/:id', managerController.updateProduct)
router.get('/settings', managerController.settings)
router.patch('/settings', managerController.updateSettings)

router.get('/reports/revenue', managerController.reportRevenue)
router.get('/reports/occupancy', managerController.reportOccupancy)
router.get('/reports/rentals', managerController.reportRentals)
router.get('/reports/customers', managerController.reportCustomers)
router.get('/reports/export/:kind', managerController.exportReport)

router.get('/activity', managerController.activity)

export default router
