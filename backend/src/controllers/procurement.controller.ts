import { z } from 'zod';
import type { Request } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { INVENTORY_CATEGORIES } from '../domain/rules.js';
import { User } from '../models/index.js';
import {
  approveOrder,
  cancelOrder,
  listOrders,
  procurementPolicy,
  raiseOrder,
  receiveOrder,
  rejectOrder,
  submitOrder,
  type ProcurementActor,
} from '../services/procurement.service.js';

/**
 * Purchase orders — §8.2.
 *
 * The actor is resolved from the verified token and their role read from the record rather
 * than the token, so a change of job takes effect at the next request. §8.2 wants an approval
 * identity on every order and the role is what the approval turns on.
 */
async function actorOf(req: Request): Promise<ProcurementActor> {
  if (!req.auth) throw ApiError.unauthorized();
  const person = await User.findById(req.auth.sub, { fullName: 1, role: 1 }).lean<{
    fullName: string;
    role: ProcurementActor['role'];
  } | null>();
  if (!person) throw ApiError.unauthorized('That account no longer exists.');
  return { id: req.auth.sub, name: person.fullName, role: person.role };
}

const raiseSchema = z.object({
  siteId: z.string().trim().min(1),
  supplier: z.string().trim().max(160).optional(),
  supportingDocument: z.string().trim().max(240).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(200),
        category: z.enum(INVENTORY_CATEGORIES),
        quantity: z.number().int().min(1).max(100_000),
        unit: z.string().trim().max(24).optional(),
        unitPrice: z.number().min(0),
      })
    )
    .min(1)
    .max(200),
});

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const noteSchema = z.object({ note: z.string().trim().max(500).optional() });
const receiveSchema = z.object({
  received: z
    .array(z.object({ index: z.number().int().min(0), quantity: z.number().min(0) }))
    .min(1),
});

export const procurementController = {
  policy: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await procurementPolicy() });
  }),

  list: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listOrders(req.query.status as string | undefined) });
  }),

  raise: asyncHandler(async (req, res) => {
    const data = await raiseOrder(await actorOf(req), raiseSchema.parse(req.body));
    res.status(201).json({ success: true, data });
  }),

  submit: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await submitOrder(await actorOf(req), req.params.id) });
  }),

  approve: asyncHandler(async (req, res) => {
    const { note } = noteSchema.parse(req.body ?? {});
    res.json({ success: true, data: await approveOrder(await actorOf(req), req.params.id, note) });
  }),

  reject: asyncHandler(async (req, res) => {
    const { reason } = reasonSchema.parse(req.body);
    res.json({ success: true, data: await rejectOrder(await actorOf(req), req.params.id, reason) });
  }),

  receive: asyncHandler(async (req, res) => {
    const { received } = receiveSchema.parse(req.body);
    res.json({
      success: true,
      data: await receiveOrder(await actorOf(req), req.params.id, received),
    });
  }),

  cancel: asyncHandler(async (req, res) => {
    const { reason } = reasonSchema.parse(req.body);
    res.json({ success: true, data: await cancelOrder(await actorOf(req), req.params.id, reason) });
  }),
};
