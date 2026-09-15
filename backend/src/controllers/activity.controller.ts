import { z } from 'zod'

import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ActivityDefinition } from '../models/index.js'
import { ACTIVITY_FIELD_KINDS, ACTIVITY_OPERATORS } from '../models/index.js'
import {
  createActivity,
  listActivities,
  publicShape,
  publishActivity,
  graphOptions,
  saveDraft,
  removeActivity,
  setActivityStatus,
  validateDefinition,
} from '../services/activity.service.js'
import type { ActivityDefinitionDoc } from '../models/index.js'
import { requireTenant } from '../platform/tenantContext.js'
import { accessForRequest } from '../services/authorisation.service.js'
import {
  activitySteps,
  applyActivityStep,
  openActivityBooking,
} from '../services/activitySession.service.js'
import { AssetType } from '../models/index.js'

/**
 * Activities, authored by the tenant that will run them.
 *
 * Everything here writes into the caller's own tenant database — the tenant comes from the
 * request context, never from the body, so there is no field a client could set to author an
 * activity inside somebody else's company.
 */

const tenantOf = (): string => requireTenant().tenantId
/** The signed-in person, from the verified token — never from anything the client sent. */
const actorOf = (req: { auth?: { sub?: string } }): string => req.auth?.sub ?? ''

const optionSchema = z.object({
  value: z.string().trim().max(80),
  label: z.string().trim().max(120),
  labelAr: z.string().trim().max(120).optional().default(''),
})

const fieldSchema = z.object({
  key: z.string().trim().max(40),
  label: z.string().trim().max(120),
  labelAr: z.string().trim().max(120).optional().default(''),
  kind: z.enum(ACTIVITY_FIELD_KINDS),
  required: z.boolean().optional().default(false),
  helpText: z.string().trim().max(240).optional().default(''),
  helpTextAr: z.string().trim().max(240).optional().default(''),
  options: z.array(optionSchema).max(60).optional().default([]),
  min: z.number().nullable().optional().default(null),
  max: z.number().nullable().optional().default(null),
  step: z.number().nullable().optional().default(null),
  assetTypeId: z.string().trim().max(80).nullable().optional().default(null),
  stage: z.enum(['DETAILS', 'PARTICIPANTS', 'ASSETS', 'CHECKS']).optional().default('DETAILS'),
  order: z.number().optional().default(0),
})

const conditionSchema = z.object({
  field: z.string().trim().max(40),
  operator: z.enum(ACTIVITY_OPERATORS),
  value: z.string().trim().max(240).optional().default(''),
  values: z.array(z.string().trim().max(120)).max(60).optional().default([]),
})

const ruleSchema = z.object({
  key: z.string().trim().max(40),
  message: z.string().trim().max(240),
  messageAr: z.string().trim().max(240).optional().default(''),
  conditions: z.array(conditionSchema).max(20).optional().default([]),
  effect: z.enum(['BLOCK', 'WARN', 'REQUIRE_SUPERVISOR']).optional().default('BLOCK'),
  appliesToTransition: z.string().trim().max(40).nullable().optional().default(null),
  active: z.boolean().optional().default(true),
})

const stateSchema = z.object({
  key: z.string().trim().max(40),
  label: z.string().trim().max(80),
  labelAr: z.string().trim().max(80).optional().default(''),
  initial: z.boolean().optional().default(false),
  terminal: z.boolean().optional().default(false),
  inProgress: z.boolean().optional().default(false),
  colour: z.string().trim().max(20).optional().default(''),
  order: z.number().optional().default(0),
})

const transitionSchema = z.object({
  key: z.string().trim().max(40),
  label: z.string().trim().max(80),
  labelAr: z.string().trim().max(80).optional().default(''),
  from: z.string().trim().max(40),
  to: z.string().trim().max(40),
  allowedRoles: z.array(z.string().trim().max(40)).max(12).optional().default([]),
  takesPayment: z.boolean().optional().default(false),
  requiresCustomerProof: z.boolean().optional().default(false),
  order: z.number().optional().default(0),
})

const draftSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  nameAr: z.string().trim().max(80).optional(),
  description: z.string().trim().max(400).optional(),
  emoji: z.string().trim().max(8).optional(),
  colour: z.string().trim().max(20).optional(),
  note: z.string().trim().max(240).optional(),
  fields: z.array(fieldSchema).max(60).optional(),
  rules: z.array(ruleSchema).max(60).optional(),
  states: z.array(stateSchema).max(30).optional(),
  transitions: z.array(transitionSchema).max(60).optional(),
  pricing: z
    .object({
      billingModel: z.string().trim().max(40),
      saleUnit: z.string().trim().max(40),
      basePrice: z.number().min(0).max(1_000_000),
      durationUnit: z.string().trim().max(40).nullable(),
      depositRequired: z.number().min(0).max(1_000_000),
      overtimeHourlyRate: z.number().min(0).max(1_000_000).nullable(),
      gracePeriodMin: z.number().min(0).max(1440),
    })
    .optional(),
  /*
   * The operating graph. See the note on ActivityRevisionDoc.
   *
   * Ids rather than free text throughout, and bounded, so this cannot become a place to store
   * arbitrary payloads on a tenant record.
   */
  siteIds: z.array(z.string().trim().max(80)).max(50).optional(),
  areaIds: z.array(z.string().trim().max(80)).max(200).optional(),
  terminalIds: z.array(z.string().trim().max(80)).max(200).optional(),
  operatorRoleKeys: z.array(z.string().trim().max(40)).max(40).optional(),
  assetTypeIds: z.array(z.string().trim().max(80)).max(40).optional(),
  eligibleResourceIds: z.array(z.string().trim().max(80)).max(500).optional(),
  consumableProductIds: z.array(z.string().trim().max(80)).max(80).optional(),
  capacity: z
    .object({
      seatsPerBooking: z.number().min(1).max(500).nullable(),
      maxConcurrent: z.number().min(1).max(5000).nullable(),
    })
    .optional(),
})

export const activityController = {
  list: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await listActivities(tenantOf()) })
  }),

  /** What an agent's screen needs: the published shape only, no drafting history. */
  published: asyncHandler(async (_req, res) => {
    const rows = await ActivityDefinition.find({
      tenantId: tenantOf(),
      status: 'PUBLISHED',
      currentRevision: { $gt: 0 },
    })
      .sort({ name: 1 })
      .lean<ActivityDefinitionDoc[]>()

    res.json({ success: true, data: rows.map(publicShape) })
  }),

  detail: asyncHandler(async (req, res) => {
    const doc = await ActivityDefinition.findOne({ tenantId: tenantOf(), _id: req.params.id }).lean()
    if (!doc) throw ApiError.notFound('No such activity.')
    res.json({ success: true, data: doc })
  }),

  create: asyncHandler(async (req, res) => {
    const body = z
      .object({
        key: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(80),
        nameAr: z.string().trim().max(80).optional(),
        description: z.string().trim().max(400).optional(),
        emoji: z.string().trim().max(8).optional(),
        colour: z.string().trim().max(20).optional(),
      })
      .parse(req.body)

    const created = await createActivity(tenantOf(), body, actorOf(req))
    res.status(201).json({ success: true, data: created })
  }),

  saveDraft: asyncHandler(async (req, res) => {
    const patch = draftSchema.parse(req.body)
    res.json({ success: true, data: await saveDraft(tenantOf(), req.params.id, patch) })
  }),

  /**
   * What is wrong with the draft, without committing to anything.
   *
   * The builder calls this as the administrator works, so problems surface next to the thing
   * that caused them rather than as a wall of text when they press publish.
   */
  check: asyncHandler(async (req, res) => {
    const tenantId = tenantOf()
    const doc = await ActivityDefinition.findOne({ tenantId, _id: req.params.id }).lean<ActivityDefinitionDoc>()
    if (!doc) throw ApiError.notFound('No such activity.')

    const kinds = await AssetType.find({ tenantId }, { _id: 1 }).lean()
    const problems = validateDefinition(doc.draft, kinds.map((k) => String(k._id)))

    res.json({ success: true, data: { publishable: problems.length === 0, problems } })
  }),

  publish: asyncHandler(async (req, res) => {
    const { note } = z.object({ note: z.string().trim().max(240).optional() }).parse(req.body ?? {})
    res.json({ success: true, data: await publishActivity(tenantOf(), req.params.id, actorOf(req), note ?? '') })
  }),

  remove: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await removeActivity(tenantOf(), req.params.id) })
  }),

  setStatus: asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(['PUBLISHED', 'ARCHIVED']) }).parse(req.body)
    res.json({ success: true, data: await setActivityStatus(tenantOf(), req.params.id, status) })
  }),

  /**
   * The vocabulary the builder offers, and the tenant's own things to wire it to.
   *
   * Two halves, deliberately in one response. The first is the platform's — the kinds of
   * question a form can ask, the comparisons a rule can make, the ways a price can be
   * charged. The second is entirely the tenant's: its locations, its jobs, its resources.
   *
   * The charging models listed here are the generic two. `PER_BAG` and `PER_COMPARTMENT`
   * are real and still honoured for WAYZ's storage products, but they are WAYZ's business
   * meaning, and offering every company on the platform a "per bag" price is exactly the
   * inheritance this architecture removes. A tenant that charges per bag says so by
   * defining a bag as a resource, not by finding its own vocabulary in a platform enum.
   */
  vocabulary: asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        fieldKinds: ACTIVITY_FIELD_KINDS,
        operators: ACTIVITY_OPERATORS,
        effects: ['BLOCK', 'WARN', 'REQUIRE_SUPERVISOR'],
        stages: ['DETAILS', 'PARTICIPANTS', 'ASSETS', 'CHECKS'],
        billingModels: ['PACKAGE', 'DURATION_BASED'],
        saleUnits: ['TOUR', 'HOUR', 'FULL_DAY', 'ITEM'],
        durationUnits: ['HOUR', 'HALF_HOUR', 'FIFTEEN_MIN', 'DAY'],
        graph: await graphOptions(tenantOf()),
      },
    })
  }),
}

/* ------------------------------------------------------------------------------------- */
/* Selling and running one                                                                  */
/* ------------------------------------------------------------------------------------- */

const openSchema = z.object({
  activityKey: z.string().trim().min(1).max(60),
  customerId: z.string().trim().min(1).max(80),
  values: z.record(z.unknown()).optional(),
  resourceId: z.string().trim().max(80).nullable().optional(),
  quantity: z.number().int().min(1).max(200).optional(),
})

const stepSchema = z.object({
  step: z.string().trim().min(1).max(60),
  values: z.record(z.unknown()).optional(),
})

/**
 * The counter's half of the activity engine.
 *
 * Kept beside the authoring endpoints because they read the same definitions, and gated
 * separately in the route file because the people are different: a manager authors, an agent
 * sells. Neither is allowed to do the other's job by calling the other's endpoint.
 */
export const activitySessionController = {
  open: asyncHandler(async (req, res) => {
    const access = await accessForRequest(req)
    const place = { stationId: req.auth!.stationId, kioskId: req.auth!.kioskId ?? null }
    const data = await openActivityBooking(access, place, openSchema.parse(req.body))
    res.status(201).json({ success: true, data })
  }),

  steps: asyncHandler(async (req, res) => {
    const access = await accessForRequest(req)
    res.json({ success: true, data: await activitySteps(access, req.params.id) })
  }),

  step: asyncHandler(async (req, res) => {
    const access = await accessForRequest(req)
    const body = stepSchema.parse(req.body)
    const data = await applyActivityStep(access, req.params.id, body.step, body.values ?? {})
    res.json({ success: true, data })
  }),
}
