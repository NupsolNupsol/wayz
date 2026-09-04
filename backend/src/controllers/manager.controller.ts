import { z } from 'zod'
import type { Request } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ENGINE_KINDS, BILLING_MODELS, DURATION_UNITS, ROLES, SALE_TYPES, SALE_UNITS } from '../domain/types.js'
import { managerIncidents, managerLiveSessions, managerOverview, managerRentals, managerRentalDetail, managerCustomers, managerCustomerDetail, managerPayments, managerShift, managerShifts } from '../services/manager.service.js'
import { createKiosk, createSite, createStation, orgTree, removeKiosk, updateKiosk, updateSite, updateStation } from '../services/org.service.js'
import { createStaff, listStaff, reinviteStaff, resetStaffPassword, updateStaff } from '../services/staff.service.js'
import { createProduct, getSettings, listPricing, updateProduct, updateSettings } from '../services/pricing.service.js'
import {
  activityLog,
  agentRevenueReport,
  customersReport,
  occupancyReport,
  rentalsReport,
  reportRows,
  revenueReport,
  toCsv,
} from '../services/reports.service.js'
import { updateIncidentStatus } from '../services/incident.service.js'
import type { ManagerScope } from '../interfaces/index.js'

function managerScope(req: Request): ManagerScope {
  if (!req.auth) throw ApiError.unauthorized()
  return {
    tenantId: req.auth.tenantId,
    userId: req.auth.sub,
    role: req.auth.role,
    engineKinds: req.auth.engineKinds ?? [],
  }
}

const engineKind = z.enum(ENGINE_KINDS)
const rangeSchema = z.object({ from: z.string().optional(), to: z.string().optional() })

const siteSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  venueType: z.string().optional(),
  address: z.string().optional(),
  contactPhone: z.string().optional(),
})

const stationSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(2),
  code: z.string().optional(),
  engineKinds: z.array(engineKind).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  contactPhone: z.string().optional(),
})

const kioskSchema = z.object({
  stationId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  location: z.string().optional(),
  engineKind,
})

const staffSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(ROLES),
  stationId: z.string().min(1),
  kioskId: z.string().nullable().optional(),
  engineKinds: z.array(z.enum(ENGINE_KINDS)).optional(),
  reportsTo: z.string().nullable().optional(),
  phone: z.string().optional(),
})

const productSchema = z.object({
  name: z.string().min(2),
  engineKind,
  category: z.string().optional(),
  basePrice: z.coerce.number().min(0),
  hourlyPrice: z.coerce.number().min(0).nullable().optional(),
  tourPrice: z.coerce.number().min(0).nullable().optional(),
  tourMinutes: z.coerce.number().int().min(1).nullable().optional(),
  saleUnit: z.enum(SALE_UNITS).optional(),
  saleType: z.enum(SALE_TYPES).optional(),
  overtimeHourlyRate: z.coerce.number().min(0).nullable().optional(),
  depositRequired: z.coerce.number().min(0).optional(),
  penaltyPrice: z.coerce.number().min(0).optional(),
  assetTypeId: z.string().nullable().optional(),
  billingModel: z.enum(BILLING_MODELS),
  durationUnit: z.enum(DURATION_UNITS).optional(),
  emoji: z.string().optional(),
})

export const managerController = {
  overview: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerOverview(managerScope(req)) })
  }),
  liveSessions: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerLiveSessions(managerScope(req)) })
  }),

  rentals: asyncHandler(async (req, res) => {
    const q = z.object({ scope: z.enum(['active', 'completed', 'expired', 'all']).default('all') }).parse(req.query)
    res.json({ success: true, data: await managerRentals(managerScope(req), q.scope) })
  }),
  rentalDetail: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerRentalDetail(managerScope(req), req.params.id) })
  }),

  customers: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerCustomers(managerScope(req)) })
  }),
  customerDetail: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerCustomerDetail(managerScope(req), req.params.id) })
  }),

  org: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await orgTree(managerScope(req)) })
  }),
  createSite: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await createSite(managerScope(req), siteSchema.parse(req.body)) })
  }),
  updateSite: asyncHandler(async (req, res) => {
    const body = siteSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body)
    res.json({ success: true, data: await updateSite(managerScope(req), req.params.id, body) })
  }),
  createStation: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await createStation(managerScope(req), stationSchema.parse(req.body)) })
  }),
  updateStation: asyncHandler(async (req, res) => {
    const body = stationSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body)
    res.json({ success: true, data: await updateStation(managerScope(req), req.params.id, body) })
  }),
  createKiosk: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await createKiosk(managerScope(req), kioskSchema.parse(req.body)) })
  }),
  removeKiosk: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await removeKiosk(managerScope(req), req.params.id) })
  }),
  updateKiosk: asyncHandler(async (req, res) => {
    const body = kioskSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body)
    res.json({ success: true, data: await updateKiosk(managerScope(req), req.params.id, body) })
  }),

  payments: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerPayments(managerScope(req)) })
  }),

  incidents: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerIncidents(managerScope(req)) })
  }),
  updateIncident: asyncHandler(async (req, res) => {
    const body = z
      .object({ status: z.enum(['REPORTED', 'INVESTIGATING', 'AWAITING_APPROVAL', 'RESOLVED', 'REJECTED']) })
      .parse(req.body)
    const scope = managerScope(req)
    const data = await updateIncidentStatus({ tenantId: scope.tenantId } as never, req.params.id, body.status)
    res.json({ success: true, data })
  }),

  shift: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerShift(managerScope(req), req.params.id) })
  }),

  shifts: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await managerShifts(managerScope(req)) })
  }),

  staff: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listStaff(managerScope(req)) })
  }),
  createStaff: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await createStaff(managerScope(req), staffSchema.parse(req.body)) })
  }),
  updateStaff: asyncHandler(async (req, res) => {
    const body = staffSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body)
    res.json({ success: true, data: await updateStaff(managerScope(req), req.params.id, body) })
  }),
  reinviteStaff: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await reinviteStaff(managerScope(req), req.params.id) })
  }),
  resetStaffPassword: asyncHandler(async (req, res) => {
    const body = z.object({ password: z.string().min(8) }).parse(req.body)
    res.json({ success: true, data: await resetStaffPassword(managerScope(req), req.params.id, body.password) })
  }),

  pricing: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listPricing(managerScope(req)) })
  }),
  createProduct: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await createProduct(managerScope(req), productSchema.parse(req.body)) })
  }),
  updateProduct: asyncHandler(async (req, res) => {
    const body = productSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body)
    res.json({ success: true, data: await updateProduct(managerScope(req), req.params.id, body) })
  }),
  settings: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getSettings(managerScope(req)) })
  }),
  updateSettings: asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).optional(),
        legalName: z.string().min(2).optional(),
        crNumber: z.string().optional(),
        vatNumber: z.string().optional(),
        vatRate: z.coerce.number().min(0).max(1).optional(),
        currency: z.string().min(3).max(5).optional(),
        company: z.record(z.string()).optional(),
        settings: z.record(z.unknown()).optional(),
      })
      .parse(req.body)
    res.json({ success: true, data: await updateSettings(managerScope(req), body) })
  }),

  reportRevenue: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await revenueReport(managerScope(req), rangeSchema.parse(req.query)) })
  }),
  reportAgents: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await agentRevenueReport(managerScope(req), rangeSchema.parse(req.query)) })
  }),
  reportOccupancy: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await occupancyReport(managerScope(req)) })
  }),
  reportRentals: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await rentalsReport(managerScope(req), rangeSchema.parse(req.query)) })
  }),
  reportCustomers: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await customersReport(managerScope(req)) })
  }),
  exportReport: asyncHandler(async (req, res) => {
    const params = z.object({ kind: z.enum(['revenue', 'occupancy', 'rentals', 'payments', 'agents']) }).parse(req.params)
    const rows = await reportRows(managerScope(req), params.kind, rangeSchema.parse(req.query))
    const csv = toCsv(rows)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${params.kind}-report.csv"`)
    res.send(csv)
  }),

  activity: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await activityLog(managerScope(req)) })
  }),
}
