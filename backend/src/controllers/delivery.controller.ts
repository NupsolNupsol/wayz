import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { ApiError } from '../utils/ApiError.js'
import { DELIVERY_ORIGINS } from '../domain/workflow.js'
import { applyDeliveryTransition, availableDeliveryTransitions, courierBoard, courierScopeFrom, createDeliveryRequest, deliveryDetail, stationDeliveries } from '../services/delivery.service.js'
import type { DeliveryActor } from '../interfaces/index.js'

const createSchema = z.object({
  bookingId: z.string().min(1),
  address: z.string().min(3, 'A delivery address is required.'),
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
      compartmentCode: z.string().optional(),
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

    // A claimed task belongs to the courier who claimed it; the others may look, not act.
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
