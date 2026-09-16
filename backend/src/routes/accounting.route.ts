import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/auth.js'
import { accountingController } from '../controllers/accounting.controller.js'

const router = Router()
router.use(authenticate, requireRole('ACCOUNTANT', 'TENANT_ADMIN'))

router.get('/summary', accountingController.summary)
router.get('/vat-return', accountingController.vatReturn)
router.get('/zakat', accountingController.zakat)
router.get('/ledger', accountingController.ledger)
router.get('/commission-rates', accountingController.commissionRates)
router.put('/commission-rates', accountingController.updateCommissionRates)
router.get('/transactions', accountingController.transactions)
router.get('/transactions/summary', accountingController.transactionSummary)
router.get('/transactions/:id', accountingController.transaction)
router.get('/payments', accountingController.payments)
router.get('/payments/:id', accountingController.payment)
router.post('/transactions/ingest', accountingController.ingest)
router.get('/reconciliation', accountingController.reconciliation)
router.get('/export', accountingController.export)
router.get('/export/activity/:engineKind', accountingController.exportActivity)
router.get('/export/all', accountingController.exportAll)

export default router
