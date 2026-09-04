import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import {
  claimTrip,
  clockStation,
  completeTrip,
  planTrips,
  startTrip,
  tripBoard,
  tripDetail,
  waitingForABoat,
  setTripRoute,
} from '../services/trip.service.js'

export const tripController = {
  waiting: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await waitingForABoat(scopeFromReq(req)) })
  }),

  plan: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await planTrips(scopeFromReq(req)) })
  }),

  board: asyncHandler(async (req, res) => {
    const mine = req.query.mine === 'true'
    res.json({ success: true, data: await tripBoard(scopeFromReq(req), mine) })
  }),

  detail: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await tripDetail(scopeFromReq(req), req.params.id) })
  }),

  claim: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await claimTrip(scopeFromReq(req), req.params.id) })
  }),

  start: asyncHandler(async (req, res) => {
    const body = z.object({ unitId: z.string().optional() }).parse(req.body ?? {})
    res.json({ success: true, data: await startTrip(scopeFromReq(req), req.params.id, body) })
  }),

  route: asyncHandler(async (req, res) => {
    const body = z.object({ stationIds: z.array(z.string().min(1)).max(24) }).parse(req.body)
    res.json({ success: true, data: await setTripRoute(scopeFromReq(req), req.params.id, body.stationIds) })
  }),

  stop: asyncHandler(async (req, res) => {
    const body = z.object({ stationId: z.string().min(1) }).parse(req.body)
    res.json({ success: true, data: await clockStation(scopeFromReq(req), req.params.id, body.stationId) })
  }),

  complete: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await completeTrip(scopeFromReq(req), req.params.id) })
  }),
}
