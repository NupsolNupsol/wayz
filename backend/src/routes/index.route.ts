import type { Express } from 'express'
import authRouter from './auth.route.js'
import customerRouter from './customer.route.js'
import catalogueRouter from './catalogue.route.js'
import bookingRouter from './booking.route.js'
import shiftRouter from './shift.route.js'
import incidentRouter from './incident.route.js'
import engineRouter from './engine.route.js'
import otpRouter from './otp.route.js'
import dashboardRouter from './dashboard.route.js'
import managerRouter from './manager.route.js'
import deliveryRouter from './delivery.route.js'
import tillRouter from './till.route.js'
import notificationRouter from './notification.route.js'
import manualSaleRouter from './manualSale.route.js'
import refundRequestRouter from './refundRequest.route.js'
import tripRouter from './trip.route.js'
import pricingRouter from './pricing.route.js'
import devClockRouter from './devClock.route.js'
import tenantAdminRouter from './tenantAdmin.route.js'
import accountingRouter from './accounting.route.js'
import hrRouter from './hr.route.js'
import publicRouter from './public.route.js'
import searchRouter from './search.route.js'
import assetRouter from './asset.route.js'

export function mountRoutes(app: Express) {
  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', ts: Date.now() }))

  app.use('/api/public', publicRouter)

  app.use('/api/auth', authRouter)
  app.use('/api/customers', customerRouter)
  app.use('/api/search', searchRouter)
  app.use('/api/catalogue', catalogueRouter)
  app.use('/api/bookings', bookingRouter)
  app.use('/api/shift', shiftRouter)
  app.use('/api/incidents', incidentRouter)
  app.use('/api/engines', engineRouter)
  app.use('/api/otp', otpRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/deliveries', deliveryRouter)
  app.use('/api/till', tillRouter)
  app.use('/api/notifications', notificationRouter)
  app.use('/api/manual-sales', manualSaleRouter)
  app.use('/api/refund-requests', refundRequestRouter)
  app.use('/api/lagoon/trips', tripRouter)
  app.use('/api/pricing', pricingRouter)
  app.use('/api/dev-clock', devClockRouter)
  app.use('/api/admin', tenantAdminRouter)
  app.use('/api/accounting', accountingRouter)
  app.use('/api/hr', hrRouter)
  app.use('/api/assets', assetRouter)
  app.use('/api/manager', managerRouter)
}
