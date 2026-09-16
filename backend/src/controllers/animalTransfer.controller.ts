import { z } from 'zod'
import type { Request } from 'express'

import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import {
  approveTransfer,
  cancelTransfer,
  departTransfer,
  listTransfers,
  raiseTransfer,
  receiveTransfer,
  rejectTransfer,
  transferPolicy,
  type TransferActor,
} from '../services/animalTransfer.service.js'
import { User } from '../models/index.js'

/**
 * Inter-location animal transfers — §7.4.
 *
 * Every action is taken *by somebody*, and §7.4 wants the approver's identity on the record,
 * so the actor is resolved from the verified token rather than taken from the body. The role
 * comes from the user record rather than the token: a demotion takes effect on the next
 * request, not at the end of a twelve-hour session.
 */
async function actorOf(req: Request): Promise<TransferActor> {
  if (!req.auth) throw ApiError.unauthorized()
  const person = await User.findById(req.auth.sub, { fullName: 1, role: 1 }).lean<{
    fullName: string
    role: TransferActor['role']
  } | null>()
  if (!person) throw ApiError.unauthorized('That account no longer exists.')
  return { id: req.auth.sub, name: person.fullName, role: person.role }
}

const raiseSchema = z.object({
  animalId: z.string().trim().min(1),
  toStationId: z.string().trim().min(1),
  driverId: z.string().trim().min(1).nullish(),
  expectedDepartureAt: z.string().trim().min(1).nullish(),
  expectedArrivalAt: z.string().trim().min(1).nullish(),
  reason: z.string().trim().max(500).optional(),
})

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) })
const noteSchema = z.object({ note: z.string().trim().max(500).optional() })
const receiveSchema = z.object({ arriveAs: z.enum(['AVAILABLE', 'RESTING']).optional() })

export const animalTransferController = {
  /** The policy in force, so a screen can say who approves before anybody tries. */
  policy: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await transferPolicy() })
  }),

  list: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listTransfers(req.query.status as string | undefined) })
  }),

  raise: asyncHandler(async (req, res) => {
    const data = await raiseTransfer(await actorOf(req), raiseSchema.parse(req.body))
    res.status(201).json({ success: true, data })
  }),

  approve: asyncHandler(async (req, res) => {
    const { note } = noteSchema.parse(req.body ?? {})
    res.json({ success: true, data: await approveTransfer(await actorOf(req), req.params.id, note) })
  }),

  reject: asyncHandler(async (req, res) => {
    const { reason } = reasonSchema.parse(req.body)
    res.json({ success: true, data: await rejectTransfer(await actorOf(req), req.params.id, reason) })
  }),

  depart: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await departTransfer(await actorOf(req), req.params.id) })
  }),

  receive: asyncHandler(async (req, res) => {
    const { arriveAs } = receiveSchema.parse(req.body ?? {})
    res.json({ success: true, data: await receiveTransfer(await actorOf(req), req.params.id, arriveAs) })
  }),

  cancel: asyncHandler(async (req, res) => {
    const { reason } = reasonSchema.parse(req.body)
    res.json({ success: true, data: await cancelTransfer(await actorOf(req), req.params.id, reason) })
  }),
}
