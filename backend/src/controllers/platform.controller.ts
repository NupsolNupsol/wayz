import { z } from 'zod'

import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ENGINE_KINDS } from '../domain/types.js'
import { listCatalogue } from '../platform/activityCatalogue.js'
import {
  createOrganisation,
  listOrganisations,
  platformReport,
  updateOrganisation,
} from '../services/platform.service.js'
import {
  assistantHealth,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  uploadKnowledgeDocument,
} from '../services/learning/knowledge.service.js'

/**
 * The platform console's endpoints.
 *
 * Every one of these is behind `authenticatePlatform`, which refuses an employee's token — so
 * nothing here needs to ask who is calling beyond that. The interesting checks are all about
 * what is being *asked for*, not who is asking.
 */

/** A window for a report. Defaults to the last thirty days, which is what a console opens on. */
const windowSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

const DEFAULT_WINDOW_DAYS = 30

function resolveWindow(query: unknown) {
  const { from, to } = windowSchema.parse(query)
  const end = to ?? new Date()
  const start = from ?? new Date(end.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  if (start > end) throw ApiError.badRequest('That window ends before it starts.')
  return { start, end }
}

/**
 * Creating an organisation.
 *
 * The first administrator's password is required rather than generated, so that nothing has to
 * transmit a generated one back through a response body, a log, or an email this deployment
 * may not be able to send. Twelve characters is the same floor the platform administrator's
 * own credential is held to.
 */
const createSchema = z.object({
  id: z.string().min(3).max(40),
  name: z.string().min(2).max(120),
  activities: z.array(z.enum(ENGINE_KINDS)).default([]),
  branding: z.record(z.string()).optional(),
  /* Filled in now if known, or later under Company details. An invoice needs all three. */
  registration: z
    .object({
      legalName: z.string().max(200).optional(),
      crNumber: z.string().max(40).optional(),
      vatNumber: z.string().max(40).optional(),
    })
    .optional(),
  admin: z.object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(12, 'An administrator password needs at least twelve characters.'),
  }),
})

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  activities: z.array(z.enum(ENGINE_KINDS)).optional(),
  branding: z.record(z.string()).optional(),
})

/**
 * A document for the assistant to learn from.
 *
 * `organizationId` is what makes it generic or specific: absent means every organisation can
 * retrieve it, present means only that one can. The AI service enforces the same split on the
 * way out, so a tenant document cannot surface in another tenant's answer.
 */
const knowledgeSchema = z.object({
  title: z.string().min(2).max(200),
  organizationId: z.string().min(2).max(40).optional(),
  /* The text itself. The browser reads the file, so nothing here handles an upload stream. */
  text: z.string().min(1),
  filename: z.string().max(200).optional(),
  language: z.string().max(10).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
})

export const platformController = {
  /** Who is signed in, for the console's header. */
  me: asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: { id: req.platform?.sub, email: req.platform?.email, name: req.platform?.name },
    })
  }),

  /** Every activity the platform has coded, which is what an organisation may adopt from. */
  catalogue: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { activities: listCatalogue() } })
  }),

  organisations: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { organisations: await listOrganisations() } })
  }),

  createOrganisation: asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body)
    res.status(201).json({ success: true, data: await createOrganisation(body) })
  }),

  updateOrganisation: asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body)
    res.json({ success: true, data: await updateOrganisation(req.params.id, body) })
  }),

  report: asyncHandler(async (req, res) => {
    const { start, end } = resolveWindow(req.query)
    res.json({ success: true, data: await platformReport(start, end) })
  }),

  /* ------------------------------------------------------------- the assistant's knowledge */

  knowledge: asyncHandler(async (req, res) => {
    const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined
    res.json({ success: true, data: await listKnowledgeDocuments({ organizationId }) })
  }),

  uploadKnowledge: asyncHandler(async (req, res) => {
    const body = knowledgeSchema.parse(req.body)

    res.status(201).json({
      success: true,
      data: await uploadKnowledgeDocument({
        title: body.title,
        organizationId: body.organizationId,
        tags: body.tags ?? [],
        text: body.text,
        filename: body.filename,
        language: body.language,
        uploadedBy: req.platform?.email ?? 'platform',
      }),
    })
  }),

  /** Whether the assistant is reachable, so the console can say so plainly. */
  assistant: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await assistantHealth() })
  }),

  reindexKnowledge: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await reindexKnowledgeDocument(req.params.id) })
  }),

  removeKnowledge: asyncHandler(async (req, res) => {
    await deleteKnowledgeDocument(req.params.id)
    res.json({ success: true, data: { removed: req.params.id } })
  }),
}
