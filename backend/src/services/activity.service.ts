import { randomUUID } from 'node:crypto'

import {
  ActivityDefinition,
  AssetType,
  AssetUnit,
  Booking,
  CatalogueProduct,
  Kiosk,
  RoleDefinition,
  Site,
  Station,
} from '../models/index.js'
import type {
  ActivityConditionDoc,
  ActivityDefinitionDoc,
  ActivityRevisionDoc,
  ActivityRuleDoc,
  ActivityStateDoc,
  ActivityTransitionDoc,
} from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Activities a tenant defines for itself.
 *
 * Two jobs live here. The first is refusing to publish something broken — a workflow with no
 * way in, a rule pointing at a field nobody fills, two states with the same name. The second
 * is evaluating those rules at the counter, from data, without ever running anything a tenant
 * typed.
 *
 * Both matter more than they look. An activity is authored by a person in a form and then
 * governs real money: if the platform accepts a definition that cannot be completed, the
 * failure surfaces in front of a customer at a desk, and the person who caused it is not the
 * person who has to explain it.
 */

/* ------------------------------------------------------------------------------------- */
/* Validation — what may be published                                                       */
/* ------------------------------------------------------------------------------------- */

const KEY = /^[a-z][a-z0-9_]{1,40}$/

export interface ActivityProblem {
  where: string
  problem: string
}

/**
 * Everything wrong with a definition, all at once.
 *
 * Deliberately not first-error-wins: somebody who has spent ten minutes building a workflow
 * should be told the four things to fix, not made to discover them one save at a time.
 */
export function validateDefinition(
  draft: Pick<ActivityRevisionDoc, 'fields' | 'rules' | 'states' | 'transitions' | 'pricing' | 'assetTypeIds'>,
  knownAssetTypeIds: string[] = [],
): ActivityProblem[] {
  const problems: ActivityProblem[] = []
  const seen = <T>(rows: T[], pick: (r: T) => string, where: string) => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(pick(r), (counts.get(pick(r)) ?? 0) + 1)
    for (const [key, n] of counts) {
      if (n > 1) problems.push({ where, problem: `"${key}" is used ${n} times. Each one must be unique.` })
    }
  }

  /* Fields */
  for (const f of draft.fields) {
    if (!KEY.test(f.key)) {
      problems.push({ where: `field "${f.label || f.key}"`, problem: 'A field key is lowercase letters, digits and underscores.' })
    }
    if (!f.label.trim()) problems.push({ where: `field "${f.key}"`, problem: 'A field needs a label the agent can read.' })
    if (f.kind === 'SELECT' && f.options.length === 0) {
      problems.push({ where: `field "${f.label}"`, problem: 'A choice field needs at least one option.' })
    }
    if (f.kind === 'NUMBER' && f.min !== null && f.max !== null && f.min > f.max) {
      problems.push({ where: `field "${f.label}"`, problem: 'The smallest value is larger than the largest.' })
    }
    if (f.kind === 'ASSET_UNIT' && f.assetTypeId && knownAssetTypeIds.length && !knownAssetTypeIds.includes(f.assetTypeId)) {
      problems.push({ where: `field "${f.label}"`, problem: 'That kind of asset does not exist in this tenant.' })
    }
  }
  seen(draft.fields, (f) => f.key, 'fields')

  /* States */
  const initial = draft.states.filter((s) => s.initial)
  if (draft.states.length === 0) {
    problems.push({ where: 'workflow', problem: 'An activity needs at least one state.' })
  }
  if (draft.states.length > 0 && initial.length !== 1) {
    problems.push({
      where: 'workflow',
      problem:
        initial.length === 0
          ? 'No state is marked as the one bookings start in.'
          : `${initial.length} states are marked as the start. Exactly one can be.`,
    })
  }
  if (draft.states.length > 0 && !draft.states.some((s) => s.terminal)) {
    problems.push({ where: 'workflow', problem: 'No state finishes the booking, so it could never be completed.' })
  }
  for (const s of draft.states) {
    if (!KEY.test(s.key)) {
      problems.push({ where: `state "${s.label || s.key}"`, problem: 'A state key is lowercase letters, digits and underscores.' })
    }
    if (!s.label.trim()) problems.push({ where: `state "${s.key}"`, problem: 'A state needs a label.' })
  }
  seen(draft.states, (s) => s.key, 'workflow states')

  /* Transitions */
  const stateKeys = new Set(draft.states.map((s) => s.key))
  for (const t of draft.transitions) {
    if (!KEY.test(t.key)) {
      problems.push({ where: `step "${t.label || t.key}"`, problem: 'A step key is lowercase letters, digits and underscores.' })
    }
    if (!t.label.trim()) problems.push({ where: `step "${t.key}"`, problem: 'A step needs a label the agent can read.' })
    if (!stateKeys.has(t.from)) problems.push({ where: `step "${t.label}"`, problem: `It starts from "${t.from}", which is not a state.` })
    if (!stateKeys.has(t.to)) problems.push({ where: `step "${t.label}"`, problem: `It leads to "${t.to}", which is not a state.` })
    if (t.from === t.to) problems.push({ where: `step "${t.label}"`, problem: 'It leads back to the state it starts from.' })
  }
  seen(draft.transitions, (t) => t.key, 'workflow steps')

  /*
   * Can a booking actually finish?
   *
   * A workflow whose steps all exist but never reach an end is the failure that only shows up
   * once a customer is standing at the desk — so it is refused here instead. Walked forwards
   * from the start; anything unreachable, or any end that cannot be reached, is named.
   */
  if (draft.states.length > 0 && initial.length === 1) {
    const outgoing = new Map<string, string[]>()
    for (const t of draft.transitions) {
      outgoing.set(t.from, [...(outgoing.get(t.from) ?? []), t.to])
    }

    const reached = new Set<string>([initial[0].key])
    const queue = [initial[0].key]
    while (queue.length) {
      for (const next of outgoing.get(queue.shift() as string) ?? []) {
        if (!reached.has(next)) {
          reached.add(next)
          queue.push(next)
        }
      }
    }

    for (const s of draft.states) {
      if (!reached.has(s.key)) {
        problems.push({ where: `state "${s.label}"`, problem: 'No sequence of steps reaches it from the start.' })
      }
    }
    if (!draft.states.some((s) => s.terminal && reached.has(s.key))) {
      problems.push({ where: 'workflow', problem: 'No finishing state can be reached from the start, so a booking could never be completed.' })
    }
  }

  /* Rules */
  const fieldKeys = new Set(draft.fields.map((f) => f.key))
  const transitionKeys = new Set(draft.transitions.map((t) => t.key))
  for (const r of draft.rules) {
    if (!r.message.trim()) {
      problems.push({ where: `rule "${r.key}"`, problem: 'A rule needs a message saying what to do about it.' })
    }
    if (r.conditions.length === 0) {
      problems.push({ where: `rule "${r.key}"`, problem: 'A rule with no conditions would never do anything.' })
    }
    if (r.appliesToTransition && !transitionKeys.has(r.appliesToTransition)) {
      problems.push({ where: `rule "${r.key}"`, problem: `It guards "${r.appliesToTransition}", which is not a step.` })
    }
    for (const c of r.conditions) {
      if (!fieldKeys.has(c.field)) {
        problems.push({ where: `rule "${r.key}"`, problem: `It tests "${c.field}", which is not a field on this activity.` })
      }
      const needsValue = ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL']
      if (needsValue.includes(c.operator) && String(c.value).trim() === '') {
        problems.push({ where: `rule "${r.key}"`, problem: `"${c.operator}" needs something to compare against.` })
      }
      if (['IS_ONE_OF', 'IS_NOT_ONE_OF'].includes(c.operator) && c.values.length === 0) {
        problems.push({ where: `rule "${r.key}"`, problem: `"${c.operator}" needs at least one value in its list.` })
      }
    }
  }
  seen(draft.rules, (r) => r.key, 'rules')

  /* Pricing */
  if (draft.pricing.basePrice < 0) problems.push({ where: 'pricing', problem: 'A price cannot be negative.' })
  if (draft.pricing.billingModel === 'DURATION_BASED' && !draft.pricing.durationUnit) {
    problems.push({ where: 'pricing', problem: 'Charging by duration needs a unit of time to charge in.' })
  }

  for (const id of draft.assetTypeIds) {
    if (knownAssetTypeIds.length && !knownAssetTypeIds.includes(id)) {
      problems.push({ where: 'assets', problem: `"${id}" is not a kind of asset in this tenant.` })
    }
  }

  return problems
}

/* ------------------------------------------------------------------------------------- */
/* The rule engine — data in, verdicts out                                                  */
/* ------------------------------------------------------------------------------------- */

const asNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : null
}

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

/**
 * One condition, evaluated.
 *
 * Every branch is a comparison this file already knows how to make. Nothing is parsed,
 * compiled or called: a tenant administrator choosing "greater than" from a dropdown selects a
 * branch here, and there is no path by which what they typed becomes something that executes.
 */
function holds(condition: ActivityConditionDoc, answers: Record<string, unknown>): boolean {
  const actual = answers[condition.field]

  switch (condition.operator) {
    case 'IS_PRESENT':
      return !isBlank(actual)
    case 'IS_BLANK':
      return isBlank(actual)
    case 'IS_TRUE':
      return actual === true || actual === 'true'
    case 'IS_FALSE':
      return actual === false || actual === 'false'
    case 'EQUALS':
      return String(actual ?? '') === String(condition.value)
    case 'NOT_EQUALS':
      return String(actual ?? '') !== String(condition.value)
    case 'IS_ONE_OF':
      return condition.values.map(String).includes(String(actual ?? ''))
    case 'IS_NOT_ONE_OF':
      return !condition.values.map(String).includes(String(actual ?? ''))
    case 'GREATER_THAN':
    case 'GREATER_OR_EQUAL':
    case 'LESS_THAN':
    case 'LESS_OR_EQUAL': {
      const left = asNumber(actual)
      const right = asNumber(condition.value)
      // Comparing something that is not a number is not a pass — it is a rule that cannot
      // be judged, and treating "unjudgeable" as "satisfied" is how a guard stops guarding.
      if (left === null || right === null) return false
      if (condition.operator === 'GREATER_THAN') return left > right
      if (condition.operator === 'GREATER_OR_EQUAL') return left >= right
      if (condition.operator === 'LESS_THAN') return left < right
      return left <= right
    }
    default:
      return false
  }
}

export interface RuleVerdict {
  key: string
  effect: ActivityRuleDoc['effect']
  message: string
  messageAr: string
}

/**
 * Which rules a set of answers falls foul of.
 *
 * `transition` narrows it to the rules guarding one step; omitted, it checks the rules that
 * guard the sale itself.
 */
export function evaluateRules(
  revision: Pick<ActivityRevisionDoc, 'rules' | 'fields'>,
  answers: Record<string, unknown>,
  transition?: string,
): RuleVerdict[] {
  const verdicts: RuleVerdict[] = []

  // A required field that was left blank is the commonest rule of all, so it is built in
  // rather than something every tenant has to remember to write.
  for (const field of revision.fields) {
    if (field.required && isBlank(answers[field.key])) {
      verdicts.push({
        key: `required:${field.key}`,
        effect: 'BLOCK',
        message: `${field.label} is needed.`,
        messageAr: field.labelAr ? `${field.labelAr} مطلوب.` : '',
      })
    }
  }

  for (const rule of revision.rules) {
    if (!rule.active) continue
    if ((rule.appliesToTransition ?? null) !== (transition ?? null)) continue

    const satisfied = rule.conditions.every((c) => holds(c, answers))
    if (!satisfied) {
      verdicts.push({ key: rule.key, effect: rule.effect, message: rule.message, messageAr: rule.messageAr })
    }
  }

  return verdicts
}

/** The steps available from where a booking currently stands, for a given job. */
export function stepsAvailable(
  revision: Pick<ActivityRevisionDoc, 'transitions'>,
  state: string,
  role: string,
): ActivityTransitionDoc[] {
  return revision.transitions
    .filter((t) => t.from === state)
    .filter((t) => t.allowedRoles.length === 0 || t.allowedRoles.includes(role))
    .sort((a, b) => a.order - b.order)
}

/* ------------------------------------------------------------------------------------- */
/* Authoring                                                                                */
/* ------------------------------------------------------------------------------------- */

/**
 * A workflow that already works, so a new activity is something to adjust rather than to
 * invent from an empty screen.
 *
 * Chosen to match what almost every counter-sold activity actually does: it is booked, it is
 * paid for, it happens, it finishes — with cancelling possible until it starts.
 */
export function starterDraft(): ActivityDefinitionDoc['draft'] {
  const state = (
    key: string,
    label: string,
    labelAr: string,
    extra: Partial<ActivityStateDoc> = {},
    order = 0,
  ): ActivityStateDoc => ({
    key,
    label,
    labelAr,
    initial: false,
    terminal: false,
    inProgress: false,
    colour: '',
    order,
    ...extra,
  })

  const step = (
    key: string,
    label: string,
    labelAr: string,
    from: string,
    to: string,
    extra: Partial<ActivityTransitionDoc> = {},
    order = 0,
  ): ActivityTransitionDoc => ({
    key,
    label,
    labelAr,
    from,
    to,
    allowedRoles: [],
    takesPayment: false,
    requiresCustomerProof: false,
    order,
    ...extra,
  })

  return {
    note: '',
    fields: [
      {
        key: 'participants',
        label: 'People',
        labelAr: 'عدد الأشخاص',
        kind: 'NUMBER',
        required: true,
        helpText: 'How many people are taking part.',
        helpTextAr: '',
        options: [],
        min: 1,
        max: null,
        step: 1,
        assetTypeId: null,
        stage: 'PARTICIPANTS',
        order: 0,
      },
      {
        key: 'notes',
        label: 'Notes',
        labelAr: 'ملاحظات',
        kind: 'NOTE',
        required: false,
        helpText: '',
        helpTextAr: '',
        options: [],
        min: null,
        max: null,
        step: null,
        assetTypeId: null,
        stage: 'DETAILS',
        order: 1,
      },
    ],
    rules: [],
    states: [
      state('draft', 'Draft', 'مسودة', { initial: true }, 0),
      state('confirmed', 'Confirmed', 'مؤكد', {}, 1),
      state('in_progress', 'In progress', 'جارٍ', { inProgress: true }, 2),
      state('completed', 'Completed', 'مكتمل', { terminal: true }, 3),
      state('cancelled', 'Cancelled', 'ملغى', { terminal: true }, 4),
    ],
    transitions: [
      step('confirm', 'Confirm & take payment', 'تأكيد والدفع', 'draft', 'confirmed', { takesPayment: true }, 0),
      step('start', 'Start', 'بدء', 'confirmed', 'in_progress', { requiresCustomerProof: true }, 1),
      step('finish', 'Finish', 'إنهاء', 'in_progress', 'completed', {}, 2),
      step('cancel', 'Cancel', 'إلغاء', 'draft', 'cancelled', {}, 3),
      step('cancel_confirmed', 'Cancel', 'إلغاء', 'confirmed', 'cancelled', {}, 4),
    ],
    pricing: {
      billingModel: 'PACKAGE',
      saleUnit: 'TOUR',
      basePrice: 0,
      durationUnit: null,
      depositRequired: 0,
      overtimeHourlyRate: null,
      gracePeriodMin: 0,
    },
    /*
     * No restriction on any axis to begin with.
     *
     * A tenant with one location should not have to enumerate it before anything works, and
     * an administrator narrows these deliberately once they know what they are building.
     */
    siteIds: [],
    areaIds: [],
    terminalIds: [],
    operatorRoleKeys: [],
    assetTypeIds: [],
    eligibleResourceIds: [],
    consumableProductIds: [],
    capacity: { seatsPerBooking: null, maxConcurrent: null },
  }
}

export async function listActivities(tenantId: string) {
  return ActivityDefinition.find({ tenantId }).sort({ name: 1 }).lean()
}

export async function createActivity(
  tenantId: string,
  input: { key: string; name: string; nameAr?: string; emoji?: string; colour?: string; description?: string },
  actorId: string,
) {
  const key = input.key.trim().toLowerCase()
  if (!KEY.test(key)) {
    throw ApiError.badRequest('An activity key is lowercase letters, digits and underscores, starting with a letter.', [
      'It is how bookings and staff assignments refer to this activity, so it cannot be changed later.',
    ])
  }

  const clash = await ActivityDefinition.findOne({ tenantId, key }).lean()
  if (clash) throw ApiError.conflict(`An activity already uses the key "${key}".`)

  return ActivityDefinition.create({
    _id: `act_${randomUUID()}`,
    tenantId,
    key,
    name: input.name.trim(),
    nameAr: input.nameAr?.trim() ?? '',
    description: input.description?.trim() ?? '',
    descriptionAr: '',
    emoji: input.emoji ?? '',
    colour: input.colour ?? '',
    status: 'DRAFT',
    draft: starterDraft(),
    revisions: [],
    currentRevision: 0,
    createdBy: actorId,
  })
}

export async function saveDraft(
  tenantId: string,
  id: string,
  patch: Partial<ActivityDefinitionDoc['draft']> & { name?: string; nameAr?: string; emoji?: string; colour?: string; description?: string },
) {
  const doc = await ActivityDefinition.findOne({ tenantId, _id: id })
  if (!doc) throw ApiError.notFound('No such activity.')

  for (const key of ['name', 'nameAr', 'emoji', 'colour', 'description'] as const) {
    if (patch[key] !== undefined) (doc as unknown as Record<string, unknown>)[key] = patch[key]
  }

  const DRAFT_FIELDS = [
    'fields', 'rules', 'states', 'transitions', 'pricing', 'capacity', 'note',
    // The operating graph: where it runs, who runs it, what it runs on.
    'siteIds', 'areaIds', 'terminalIds', 'operatorRoleKeys',
    'assetTypeIds', 'eligibleResourceIds', 'consumableProductIds',
  ] as const

  for (const key of DRAFT_FIELDS) {
    if (patch[key] !== undefined) (doc.draft as unknown as Record<string, unknown>)[key] = patch[key]
  }

  doc.markModified('draft')
  await doc.save()
  return doc.toObject()
}

/**
 * Freezes the draft as a new revision.
 *
 * Refused if the definition would not work. Everything already sold keeps pointing at the
 * revision it was sold under, which is the whole reason revisions exist.
 */
export async function publishActivity(tenantId: string, id: string, actorId: string, note = '') {
  const doc = await ActivityDefinition.findOne({ tenantId, _id: id })
  if (!doc) throw ApiError.notFound('No such activity.')

  const kinds = await AssetType.find({ tenantId }, { _id: 1 }).lean()
  const problems = validateDefinition(doc.draft, kinds.map((k) => String(k._id)))

  if (problems.length) {
    throw ApiError.badRequest(
      'This activity cannot be published yet.',
      problems.map((p) => `${p.where}: ${p.problem}`),
    )
  }

  const revision = doc.currentRevision + 1
  doc.revisions.push({
    ...(JSON.parse(JSON.stringify(doc.draft)) as ActivityDefinitionDoc['draft']),
    revision,
    publishedAt: new Date(),
    publishedBy: actorId,
    note,
  } as ActivityRevisionDoc)

  doc.currentRevision = revision
  doc.status = 'PUBLISHED'
  await doc.save()
  return doc.toObject()
}

/**
 * Removes an activity outright.
 *
 * Refused the moment anything has been sold under it. A booking is a promise about the
 * conditions it was made under, and those conditions live in this document — deleting it
 * would leave real bookings pointing at nothing, which is worse than a cluttered list.
 *
 * For an activity that has been used, archiving is the answer: it stops being offered and
 * everything already sold still resolves. This exists for the one created by mistake.
 */
export async function removeActivity(tenantId: string, id: string) {
  const doc = await ActivityDefinition.findOne({ tenantId, _id: id }).lean<ActivityDefinitionDoc>()
  if (!doc) throw ApiError.notFound('No such activity.')

  const sold = await Booking.countDocuments({ tenantId, 'activity.key': doc.key })
  if (sold > 0) {
    throw ApiError.badRequest(`"${doc.name}" has ${sold} booking(s) against it and cannot be deleted.`, [
      'Archive it instead: it stops being offered, and everything already sold still resolves.',
    ])
  }

  await ActivityDefinition.deleteOne({ tenantId, _id: id })
  return { removed: doc.key }
}

export async function setActivityStatus(tenantId: string, id: string, status: 'PUBLISHED' | 'ARCHIVED') {
  const doc = await ActivityDefinition.findOne({ tenantId, _id: id })
  if (!doc) throw ApiError.notFound('No such activity.')

  if (status === 'PUBLISHED' && doc.currentRevision === 0) {
    throw ApiError.badRequest('This activity has never been published, so there is nothing to restore.')
  }

  doc.status = status
  await doc.save()
  return doc.toObject()
}

/**
 * The revision a booking should be judged against.
 *
 * A booking names the revision it was sold under and always gets that one, even after the
 * activity has been edited ten times since. Falling back to the current revision would be the
 * bug this design exists to prevent, so an unknown revision is an error rather than a guess.
 */
export function revisionFor(doc: ActivityDefinitionDoc, revision?: number): ActivityRevisionDoc {
  const wanted = revision ?? doc.currentRevision
  const found = doc.revisions.find((r) => r.revision === wanted)
  if (!found) {
    throw ApiError.badRequest(
      `Revision ${wanted} of "${doc.name}" does not exist.`,
      ['A booking must be judged against the revision it was sold under.'],
    )
  }
  return found
}

/** Just enough for an agent's screen: the published shape, without the drafting history. */
export function publicShape(doc: ActivityDefinitionDoc) {
  const live = doc.currentRevision > 0 ? doc.revisions.find((r) => r.revision === doc.currentRevision) : null
  return {
    id: doc._id,
    key: doc.key,
    name: doc.name,
    nameAr: doc.nameAr,
    description: doc.description,
    emoji: doc.emoji,
    colour: doc.colour,
    status: doc.status,
    revision: doc.currentRevision,
    fields: live?.fields ?? [],
    states: live?.states ?? [],
    transitions: live?.transitions ?? [],
    pricing: live?.pricing ?? null,
    assetTypeIds: live?.assetTypeIds ?? [],
    /* The operating graph, so a counter and an employee form can read it. */
    siteIds: live?.siteIds ?? [],
    areaIds: live?.areaIds ?? [],
    terminalIds: live?.terminalIds ?? [],
    operatorRoleKeys: live?.operatorRoleKeys ?? [],
    eligibleResourceIds: live?.eligibleResourceIds ?? [],
    capacity: live?.capacity ?? null,
  }
}

/* ------------------------------------------------------------------------------------- */
/* What the builder may wire an activity to                                                 */
/* ------------------------------------------------------------------------------------- */

/**
 * The tenant's own estate, jobs and things — everything the graph tab offers.
 *
 * Read from the tenant's database, never from a platform constant. A company that has built
 * three locations and fifteen jobs is offered three locations and fifteen jobs; a company on
 * its first day is offered nothing, which is the truthful answer and reads as such on screen.
 *
 * One call rather than five, because the tab needs all of it before it can render anything,
 * and five round trips through five differently-gated endpoints is how a builder ends up
 * half-populated for a manager whose role can read areas but not products.
 */
export interface ActivityGraphOptions {
  sites: { id: string; name: string }[]
  areas: { id: string; siteId: string; name: string }[]
  terminals: { id: string; areaId: string; name: string }[]
  roles: { key: string; label: string }[]
  resourceKinds: { id: string; name: string }[]
  resources: { id: string; kindId: string; identifier: string; areaId: string | null }[]
  products: { id: string; name: string }[]
}

export async function graphOptions(tenantId: string): Promise<ActivityGraphOptions> {
  const [sites, areas, terminals, roles, kinds, units, products] = await Promise.all([
    Site.find({ tenantId, active: true }, { name: 1 }).sort({ name: 1 }).lean(),
    Station.find({ tenantId, active: true }, { name: 1, siteId: 1 }).sort({ name: 1 }).lean(),
    Kiosk.find({ tenantId, active: true }, { name: 1, stationId: 1 }).sort({ name: 1 }).lean(),
    RoleDefinition.find({ tenantId, active: true }, { key: 1, label: 1 }).sort({ order: 1 }).lean(),
    AssetType.find({ tenantId, active: true }, { name: 1 }).sort({ name: 1 }).lean(),
    AssetUnit.find({ tenantId }, { identifier: 1, assetTypeId: 1, stationId: 1 }).sort({ identifier: 1 }).lean(),
    CatalogueProduct.find({ tenantId, active: true }, { name: 1 }).sort({ name: 1 }).lean(),
  ])

  return {
    sites: sites.map((s) => ({ id: String(s._id), name: s.name })),
    areas: areas.map((a) => ({ id: String(a._id), siteId: String(a.siteId ?? ''), name: a.name })),
    terminals: terminals.map((t) => ({ id: String(t._id), areaId: String(t.stationId ?? ''), name: t.name })),
    roles: roles.map((r) => ({ key: r.key, label: r.label })),
    resourceKinds: kinds.map((k) => ({ id: String(k._id), name: k.name })),
    resources: units.map((u) => ({
      id: String(u._id),
      kindId: String(u.assetTypeId ?? ''),
      identifier: u.identifier,
      areaId: u.stationId ? String(u.stationId) : null,
    })),
    products: products.map((p) => ({ id: String(p._id), name: p.name })),
  }
}
