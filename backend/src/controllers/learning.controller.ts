import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import type { Role } from '../domain/types.js';
import { learningEnabled } from '../services/learning/aiClient.js';
import {
  ask,
  onboardingState,
  recordFeedback,
  recordVideoClick,
  saveOnboarding,
  speak,
  tourKeyFor,
  type SessionIdentity,
} from '../services/learning/learning.service.js';

/**
 * The employee-facing assistant.
 *
 * Every handler takes its identity from `req.auth`, which the authenticate middleware wrote
 * from the signed session token. There is no schema field here for a tenant, a role or a
 * user id, which is the simplest possible way to guarantee none is read from a body.
 */

/** The signed-in person, from the verified token — never from anything the client sent. */
function identityOf(req: { auth?: { sub?: string; role?: Role } }): SessionIdentity {
  const sub = req.auth?.sub;
  const role = req.auth?.role;
  if (!sub || !role) throw ApiError.unauthorized();
  return { sub, role };
}

/**
 * What a page may tell the assistant about itself.
 *
 * A closed list, and every field capped. The assistant is useful because it knows which
 * screen somebody is on; it must not become a pipe that ships whatever a component happened
 * to be holding — a customer's phone number, a card's last four digits — to a third party.
 */
const pageSchema = z.object({
  pageKey: z.string().trim().max(120).optional(),
  route: z.string().trim().max(300).optional(),
  module: z.string().trim().max(60).optional(),
  screenTitle: z.string().trim().max(200).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityStatus: z.string().trim().max(60).optional(),
  availableActions: z.array(z.string().trim().max(60)).max(20).optional(),
  facts: z.record(z.string().max(40), z.string().max(120)).optional(),
});

const chatSchema = z.object({
  question: z.string().trim().min(1, 'اكتب سؤالك أولاً.').max(2000),
  page: pageSchema.optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(8)
    .optional(),
  conversationId: z.string().trim().max(64).optional(),
});

const speechSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  interactionId: z.string().trim().max(64).optional(),
});

const feedbackSchema = z.object({
  interactionId: z.string().trim().min(1).max(64),
  helpful: z.boolean(),
  comment: z.string().trim().max(500).optional(),
});

const videoClickSchema = z.object({
  url: z.string().trim().max(500),
  title: z.string().trim().max(200).optional(),
  interactionId: z.string().trim().max(64).optional(),
  documentId: z.string().trim().max(64).optional(),
});

const onboardingSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
  stepIndex: z.number().int().min(0).max(99).optional(),
  completedStep: z.string().trim().max(80).optional(),
  restart: z.boolean().optional(),
});

export const learningController = {
  /**
   * Whether this deployment has an assistant, so the UI can hide the button rather than
   * offering one that answers with an error.
   */
  capability: asyncHandler(async (req, res) => {
    const identity = identityOf(req);
    res.json({
      success: true,
      data: { enabled: learningEnabled(), tourKey: tourKeyFor(identity.role) },
    });
  }),

  ask: asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    res.json({ success: true, data: await ask(identityOf(req), body) });
  }),

  speak: asyncHandler(async (req, res) => {
    const body = speechSchema.parse(req.body);
    const { buffer, contentType } = await speak(identityOf(req), body.text, body.interactionId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(buffer.length));
    // Private: this is one employee's answer read aloud, not a public asset.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }),

  feedback: asyncHandler(async (req, res) => {
    await recordFeedback(identityOf(req), feedbackSchema.parse(req.body));
    res.json({ success: true, data: { recorded: true } });
  }),

  videoClick: asyncHandler(async (req, res) => {
    await recordVideoClick(identityOf(req), videoClickSchema.parse(req.body));
    res.json({ success: true, data: { recorded: true } });
  }),

  onboarding: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await onboardingState(identityOf(req)) });
  }),

  saveOnboarding: asyncHandler(async (req, res) => {
    const body = onboardingSchema.parse(req.body);
    res.json({ success: true, data: await saveOnboarding(identityOf(req), body) });
  }),
};
