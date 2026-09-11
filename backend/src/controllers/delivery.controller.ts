import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { ApiError } from '../utils/ApiError.js'
import { DELIVERY_ORIGINS } from '../domain/workflow.js'
import { applyDeliveryTransition, availableDeliveryTransitions, collectStop, courierBoard, customerBagsElsewhere, courierScopeFrom, createDeliveryRequest, deliveryDetail, exitGates, requestStorageRun, stationDeliveries } from '../services/delivery.service.js'
import type { DeliveryActor } from '../interfaces/index.js'

const createSchema = z.object({
  bookingId: z.string().min(1),
  alsoBookingIds: z.array(z.string()).optional(),
  // One of the two: the exit gate the customer will collect from, or a written address.
  toKioskId: z.string().min(1).optional(),
  address: z.string().min(3, 'A delivery address is required.').optional(),
  notes: z.string().max(500).optional(),
  contactPhone: z.string().max(40).optional(),
  origin: z.enum(DELIVERY_ORIGINS as unknown as [string, ...string[]]),
  fee: z.number().min(0).optional(),
})


const transitionSchema = z.object({
  code: z.string().min(1),
  payload: z
    .object({
      confirmCourierId: z.string().optional(),
      handedOver: z.boolean().optional(),
      scannedBarcodes: z.array(z.string()).optional(),
      reason: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
})

async function courierActor(req: Parameters<typeof scopeFromReq>[0]): Promise<DeliveryActor> {
  if (!req.auth) throw ApiError.unauthorized()
  const s = await courierScopeFrom(req.auth.tenantId, req.auth.stationId, req.auth.sub, req.auth.role)
  return { tenantId: s.tenantId, userId: s.userId, role: s.role, siteId: s.siteId }
}

function kioskActor(req: Parameters<typeof scopeFromReq>[0]): DeliveryActor {
  const s = scopeFromReq(req)
  return { tenantId: s.tenantId, userId: s.agentId, role: s.role, stationId: s.stationId }
}

export const deliveryController = {
  create: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const body = createSchema.parse(req.body)
    const doc = await createDeliveryRequest(s, { ...body, origin: body.origin as never })
    res.status(201).json({ success: true, data: doc })
  }),

  /** Raises the run that carries a customer's bags from the counter to the gate holding their locker. */
  storageRun: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const { bookingId } = z.object({ bookingId: z.string().min(1) }).parse(req.body)
    res.status(201).json({ success: true, data: await requestStorageRun(s, bookingId) })
  }),

  exitGates: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await exitGates(scopeFromReq(req)) })
  }),

  station: asyncHandler(async (req, res) => {
    const s = scopeFromReq(req)
    const rows = await stationDeliveries(s, {
      status: req.query.status as string | undefined,
      bookingId: req.query.bookingId as string | undefined,
    })
    res.json({ success: true, data: rows })
  }),

  kioskTransition: asyncHandler(async (req, res) => {
    const body = transitionSchema.parse(req.body)
    const { delivery } = await applyDeliveryTransition({
      actor: kioskActor(req),
      id: req.params.id,
      code: body.code,
      payload: body.payload ?? {},
    })
    res.json({ success: true, data: delivery })
  }),

  board: asyncHandler(async (req, res) => {
    if (!req.auth) throw ApiError.unauthorized()
    const s = await courierScopeFrom(req.auth.tenantId, req.auth.stationId, req.auth.sub, req.auth.role)
    res.json({ success: true, data: await courierBoard(s) })
  }),

  customerBags: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await customerBagsElsewhere(scopeFromReq(req), req.params.bookingId) })
  }),

  collectStop: asyncHandler(async (req, res) => {
    const body = z.object({ scannedBarcodes: z.array(z.string()).default([]) }).parse(req.body ?? {})
    const delivery = await collectStop(await courierActor(req), req.params.id, body)
    res.json({ success: true, data: delivery })
  }),


  courierTransition: asyncHandler(async (req, res) => {
    const body = transitionSchema.parse(req.body)
    const { delivery } = await applyDeliveryTransition({
      actor: await courierActor(req),
      id: req.params.id,
      code: body.code,
      payload: body.payload ?? {},
    })
    res.json({ success: true, data: delivery })
  }),

  detail: asyncHandler(async (req, res) => {
    if (!req.auth) throw ApiError.unauthorized()
    const oversight = req.auth.role === 'MANAGER' || req.auth.role === 'TENANT_ADMIN'
    const actor = oversight
      ? { tenantId: req.auth.tenantId, userId: req.auth.sub, role: req.auth.role }
      : req.auth.role === 'DELIVERY_AGENT'
        ? await courierActor(req)
        : kioskActor(req)
    const data = await deliveryDetail(req.auth.tenantId, req.params.id, actor)

    const claimedByAnother =
      req.auth.role === 'DELIVERY_AGENT' &&
      !!data.delivery.assignedTo &&
      data.delivery.assignedTo !== req.auth.sub

    res.json({
      success: true,
      data: {
        ...data,
        mine: req.auth.role !== 'DELIVERY_AGENT' || !claimedByAnother,
        transitions: claimedByAnother ? [] : availableDeliveryTransitions(data.delivery.status, req.auth.role),
      },
    })
  }),
}
