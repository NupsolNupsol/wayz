import {
  ActivityDefinition,
  AssetUnit,
  Booking,
  Customer,
  Order,
  Tenant,
} from '../models/index.js'
import type { ActivityDefinitionDoc, ActivityRevisionDoc, BookingDoc } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { computeTotals, round2 } from '../utils/helpers.js'
import { formatId, nextSequence, pad } from './counter.service.js'
import { evaluateRules, stepsAvailable } from './activity.service.js'
import { mayUseResource } from './resourceScope.service.js'
import type { EffectiveAccess } from './authorisation.service.js'
import type { OrderLine } from '../models/order.model.js'
import { DEFAULT_VAT_RATE } from '../domain/tax.js'

/**
 * Selling and running an activity a tenant defined for itself.
 *
 * The generic counterpart to the built-in engines. Where `booking.service.ts` knows what a bag
 * drop is and what a boat trip is, nothing here knows what anything is: it reads the published
 * revision the sale is made under and does what that revision says.
 *
 * ## What is shared and what is not
 *
 * Everything about *money* is shared — orders, VAT, payments, refunds, receipts, the till. An
 * activity sale lands in the same ledger as every other sale, which is why a company's
 * accountant sees one statement rather than two.
 *
 * Everything about *meaning* comes from the tenant — what is asked at the counter, what has to
 * be true before it can be sold, what steps it moves through, who may take each step, what it
 * costs and what it runs on. None of it is in this file; all of it is in the revision.
 *
 * ## Why the revision and not the activity
 *
 * A booking is read back against **the revision it was sold under**, never the current one. An
 * activity republished with a new price or an extra step must not retrospectively change what
 * somebody already bought, and one that is archived must leave everything sold under it still
 * completable. That is the entire reason activities are revisioned, and reading the live
 * revision here would quietly throw it away.
 */

/** The published definition and the exact revision, resolved together. */
interface Live {
  definition: ActivityDefinitionDoc
  revision: ActivityRevisionDoc
}

const revisionOf = (definition: ActivityDefinitionDoc, revision: number): ActivityRevisionDoc | null =>
  definition.revisions.find((r) => r.revision === revision) ?? null

/**
 * An activity's own state key, written into the field the built-in engines use for theirs.
 *
 * The same column and the same concept — where this booking stands — but the engines' set is
 * closed and a company's is not, and cannot be: the whole point is that a tenant decides what
 * steps its work has. The engines keep their exhaustive union, because their code switches
 * over it and should keep having to; this is the one place a key outside it is stored, and it
 * is stated here rather than repeated as an unexplained cast at each of the three writes.
 *
 * Nothing reads it back through that union. An activity booking is refused by every built-in
 * workflow entry point, and is read back through `loadActivityBooking`, which resolves the
 * revision the booking was sold under and takes its states from there.
 */
const asState = (key: string) => key as BookingDoc['status']

/**
 * The activity this person is about to sell, if they may.
 *
 * Three gates, in the order a person would ask them: does it exist and is it published, may
 * this job work it, and may this counter sell it.
 */
async function sellable(access: EffectiveAccess, key: string): Promise<Live> {
  const definition = await ActivityDefinition.findOne({
    tenantId: access.tenantId,
    key,
    status: 'PUBLISHED',
    currentRevision: { $gt: 0 },
  }).lean<ActivityDefinitionDoc>()

  if (!definition) throw ApiError.notFound(`No published activity called "${key}".`)

  const revision = revisionOf(definition, definition.currentRevision)
  if (!revision) throw ApiError.unprocessable(`${definition.name} has no published revision.`)

  /*
   * Assigned the activity, or scoped to all of them.
   *
   * A supervisor whose job says `activities: ALL` sells anything the company publishes; anybody
   * else sells what they were assigned when they were hired.
   */
  if (access.scope.activities !== 'ALL' && !access.activityKeys.includes(key)) {
    throw ApiError.forbidden(`You are not assigned to ${definition.name}.`)
  }

  const operators = revision.operatorRoleKeys ?? []
  if (access.roleKey && operators.length > 0 && !operators.includes(access.roleKey)) {
    throw ApiError.forbidden(`${access.roleLabel} does not run ${definition.name}.`)
  }

  const counters = revision.terminalIds ?? []
  if (counters.length > 0 && access.terminalIds.length > 0) {
    const atOne = access.terminalIds.some((t) => counters.includes(t))
    if (!atOne) throw ApiError.forbidden(`${definition.name} is not sold at your counter.`)
  }

  return { definition, revision }
}

/** What one booking of this activity costs, from the revision and nothing else. */
function priceOf(revision: ActivityRevisionDoc, quantity: number): OrderLine[] {
  const { pricing } = revision
  const lines: OrderLine[] = []

  lines.push({
    productId: `activity:${revision.revision}`,
    name: quantity > 1 ? `× ${quantity}` : '',
    nameAr: '',
    quantity: 1,
    unitPrice: round2(pricing.basePrice * quantity),
    isDeposit: false,
    taxable: true,
  })

  if (pricing.depositRequired > 0) {
    lines.push({
      productId: `activity:${revision.revision}:deposit`,
      name: 'Refundable deposit',
      nameAr: 'مبلغ مسترد',
      quantity: 1,
      unitPrice: pricing.depositRequired,
      isDeposit: true,
      taxable: false,
    })
  }

  return lines
}

export interface OpenActivityInput {
  activityKey: string
  customerId: string
  /** The answers to the questions this activity's counter form asks. */
  values?: Record<string, unknown>
  /** The particular resource this booking is to use, when it uses one. */
  resourceId?: string | null
  quantity?: number
}

/**
 * Opens a booking of a tenant's own activity.
 *
 * Everything refused here is refused with the tenant's own words, because every reason comes
 * from the tenant's own configuration.
 */
export async function openActivityBooking(
  access: EffectiveAccess,
  place: { stationId: string; kioskId: string | null },
  input: OpenActivityInput,
) {
  const { definition, revision } = await sellable(access, input.activityKey)
  const values = input.values ?? {}

  /* What the company said has to be true before this can be sold. */
  const verdicts = evaluateRules(revision, values)
  const blocking = verdicts.filter((v) => v.effect === 'BLOCK')
  if (blocking.length) {
    throw ApiError.unprocessable(`${definition.name} cannot be booked yet.`, blocking.map((v) => v.message))
  }

  const customer = await Customer.findOne({ _id: input.customerId, tenantId: access.tenantId }).lean()
  if (!customer) throw ApiError.notFound('Customer not found.')

  /*
   * The resource, if one was named.
   *
   * Checked at the moment of assignment rather than trusted from the list the screen was drawn
   * from: that list can be minutes old, and an animal can be stood down in between.
   */
  let resource: { _id: string; identifier: string } | null = null
  if (input.resourceId) {
    if (!(await mayUseResource(access, input.resourceId))) {
      throw ApiError.forbidden('That is not one of yours to put to work.')
    }
    const eligible = revision.eligibleResourceIds ?? []
    const kinds = revision.assetTypeIds ?? []
    const unit = await AssetUnit.findOne({ _id: input.resourceId, tenantId: access.tenantId }).lean()
    if (!unit) throw ApiError.notFound('No such resource.')
    if (eligible.length > 0 && !eligible.includes(String(unit._id))) {
      throw ApiError.unprocessable(`${unit.identifier} is not one of the ones ${definition.name} uses.`)
    }
    if (eligible.length === 0 && kinds.length > 0 && !kinds.includes(String(unit.assetTypeId))) {
      throw ApiError.unprocessable(`${unit.identifier} is not the kind of thing ${definition.name} uses.`)
    }
    if (unit.status !== 'AVAILABLE') {
      throw ApiError.unprocessable(`${unit.identifier} is not available.`)
    }
    resource = { _id: String(unit._id), identifier: unit.identifier }
  }

  const initial = revision.states.find((s) => s.initial)
  if (!initial) throw ApiError.unprocessable(`${definition.name} has no starting step.`)

  const tenant = await Tenant.findById(access.tenantId).lean()
  const vatRate = tenant?.vatRate ?? DEFAULT_VAT_RATE
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1))

  const lines = priceOf(revision, quantity).map((l) => ({
    ...l,
    name: l.name ? `${definition.name} ${l.name}`.trim() : definition.name,
    nameAr: l.nameAr || definition.nameAr || definition.name,
  }))
  const totals = computeTotals(lines, vatRate)

  const [bookingSeq, orderSeq] = await Promise.all([nextSequence('booking'), nextSequence('order')])

  const order = await Order.create({
    _id: formatId('order', orderSeq),
    ref: `INV-${pad(orderSeq)}`,
    tenantId: access.tenantId,
    stationId: place.stationId,
    kioskId: place.kioskId,
    agentId: access.userId,
    customerId: input.customerId,
    engineKind: null,
    activityKey: definition.key,
    lines,
    status: 'DRAFT',
    hold: null,
    ...totals,
  })

  const booking = await Booking.create({
    _id: formatId('booking', bookingSeq),
    // The activity's own key leads the reference, so a company reads its own vocabulary on a
    // receipt rather than a platform abbreviation for a thing it does not run.
    ref: `${definition.key.slice(0, 3).toUpperCase()}-${pad(bookingSeq)}`,
    tenantId: access.tenantId,
    stationId: place.stationId,
    kioskId: place.kioskId,
    agentId: access.userId,
    orderId: order._id,
    customerId: input.customerId,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email ?? '',
    engineKind: null,
    activity: {
      key: definition.key,
      name: definition.name,
      nameAr: definition.nameAr ?? '',
      revision: definition.currentRevision,
    },
    productName: definition.name,
    productNameAr: definition.nameAr ?? '',
    baseAmount: totals.subtotal,
    vatAmount: totals.vat,
    totalAmount: totals.total,
    vatRate,
    status: asState(initial.key),
    bags: [],
    session: {
      kind: 'ACTIVITY',
      status: asState(initial.key),
      requestedDurationMin: 0,
      gracePeriodMin: revision.pricing.gracePeriodMin,
      overtimeHourlyRate: revision.pricing.overtimeHourlyRate ?? 0,
      expiryWarningSentAt: null,
    },
    reservation: null,
    packingPlan: null,
    assetUnitId: resource?._id ?? null,
    metadata: { values, quantity },
  })

  if (resource) {
    await AssetUnit.updateOne(
      { _id: resource._id, tenantId: access.tenantId },
      { $set: { status: 'RESERVED', currentBookingId: booking._id } },
    )
  }

  return { booking: booking.toObject(), order: order.toObject() }
}

/** Where this booking stands, and where it can go from here for this person. */
export async function activitySteps(access: EffectiveAccess, bookingId: string) {
  const { booking, revision } = await loadActivityBooking(access, bookingId)
  const steps = stepsAvailable(revision, booking.status, access.roleKey ?? booking.agentId)
  return {
    state: revision.states.find((s) => s.key === booking.status) ?? null,
    steps: steps.map((t) => ({ key: t.key, label: t.label, labelAr: t.labelAr, to: t.to })),
  }
}

/** A booking of a tenant activity, with the revision it was sold under. */
async function loadActivityBooking(access: EffectiveAccess, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, tenantId: access.tenantId })
  if (!booking) throw ApiError.notFound('Booking not found.')
  if (!booking.activity) throw ApiError.unprocessable('That booking is not an activity booking.')

  const definition = await ActivityDefinition.findOne({
    tenantId: access.tenantId,
    key: booking.activity.key,
  }).lean<ActivityDefinitionDoc>()
  if (!definition) throw ApiError.notFound('That activity no longer exists.')

  /*
   * The revision it was sold under, even if the activity has since been republished or
   * archived. Anything already sold has to remain completable on the terms it was sold on.
   */
  const revision = revisionOf(definition, booking.activity.revision)
  if (!revision) {
    throw ApiError.unprocessable(
      `${booking.activity.name} revision ${booking.activity.revision} is missing, so this booking cannot be read back.`,
    )
  }

  return { booking, definition, revision }
}

/**
 * Moves a booking one step along its activity's own workflow.
 *
 * The step has to exist in the revision, start where the booking currently stands, and admit
 * the job of the person taking it. Rules attached to that step are evaluated against the
 * answers held on the booking, with anything new merged in first.
 */
export async function applyActivityStep(
  access: EffectiveAccess,
  bookingId: string,
  stepKey: string,
  values: Record<string, unknown> = {},
) {
  const { booking, revision } = await loadActivityBooking(access, bookingId)

  const step = revision.transitions.find((t) => t.key === stepKey && t.from === booking.status)
  if (!step) {
    throw ApiError.unprocessable(`"${stepKey}" is not a step from "${booking.status}".`)
  }

  /*
   * Who may take this step.
   *
   * Named by the tenant's own job keys. A step naming none is open to anybody who can reach the
   * booking at all, which is the sensible default for an activity that has not bothered.
   */
  if (step.allowedRoles.length > 0) {
    const mine = access.roleKey && step.allowedRoles.includes(access.roleKey)
    if (!mine) throw ApiError.forbidden(`${access.roleLabel} may not ${step.label.toLowerCase()}.`)
  }

  const answers = { ...((booking.metadata?.values as Record<string, unknown>) ?? {}), ...values }
  const blocking = evaluateRules(revision, answers, stepKey).filter((v) => v.effect === 'BLOCK')
  if (blocking.length) {
    throw ApiError.unprocessable(`Cannot ${step.label.toLowerCase()}.`, blocking.map((v) => v.message))
  }

  const target = revision.states.find((s) => s.key === step.to)
  if (!target) throw ApiError.unprocessable(`Step "${stepKey}" leads nowhere.`)

  booking.status = asState(target.key)
  booking.session.status = asState(target.key)
  booking.metadata = { ...booking.metadata, values: answers }

  if (target.inProgress && !booking.session.startedAt) booking.session.startedAt = new Date()

  booking.transitionLog.push({
    code: stepKey,
    from: asState(step.from),
    to: asState(target.key),
    at: new Date(),
    by: access.userId,
    reason: access.roleLabel,
  })

  await booking.save()

  /*
   * A finished booking gives its resource back.
   *
   * Held from the moment it is booked and released the moment it is done — otherwise a horse
   * stays reserved to a ride that ended an hour ago and nobody can take it out again.
   */
  if (target.terminal && booking.assetUnitId) {
    await AssetUnit.updateOne(
      { _id: booking.assetUnitId, tenantId: access.tenantId },
      { $set: { status: 'AVAILABLE', currentBookingId: null } },
    )
  }

  return booking.toObject()
}
