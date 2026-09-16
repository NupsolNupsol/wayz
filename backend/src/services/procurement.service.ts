import { PurchaseOrder, Tenant } from '../models/index.js'
import type { PurchaseOrderDoc, PurchaseOrderLine } from '../models/purchaseOrder.model.js'
import { ApiError } from '../utils/ApiError.js'
import { nextSequence, pad } from './counter.service.js'
import { recordAudit } from './audit.service.js'
import { resolveProcurementRules, type InventoryCategory, type ProcurementRules } from '../domain/rules.js'
import { requireOrganisation } from '../platform/orgScope.js'
import { round2 } from '../utils/helpers.js'
import type { Role } from '../domain/types.js'

/**
 * Purchase orders — §8.2.
 *
 * Procurement is not an activity: nobody sells it and no visitor sees it. It is an internal
 * flow from "a location is running out of feed" to "the feed arrived and the count went up".
 *
 * ## What is configuration rather than code
 *
 * Two things, for the same reason as the transfer approvers: the specification does not settle
 * them, and guessing in code buries the guess.
 *
 *  - **Who approves** — §8.2 names Administrative Manager for standard items and CEO or
 *    Project Manager above a threshold.
 *  - **Where that threshold is** — never stated anywhere in the document.
 *
 * See `ProcurementRules`. This service enforces whatever the organisation has set.
 */

export interface ProcurementActor {
  id: string
  name: string
  role: Role
}

async function rulesFor(): Promise<ProcurementRules> {
  const organisation = await Tenant.findById(requireOrganisation(), { procurementRules: 1 }).lean<{
    procurementRules?: Partial<ProcurementRules>
  } | null>()
  return resolveProcurementRules(organisation?.procurementRules)
}

function log(order: PurchaseOrderDoc, action: string, actor: ProcurementActor, note = '') {
  order.log.push({ action, by: actor.id, byName: actor.name, role: actor.role, at: new Date(), note })
}

const totalOf = (lines: PurchaseOrderLine[]) =>
  round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0))

/** Who may approve *this* order — which depends on what it costs. §8.2. */
function approversFor(order: PurchaseOrderDoc, rules: ProcurementRules): string[] {
  return order.highValue ? rules.highValueApprovers : rules.standardApprovers
}

export interface RaiseOrderInput {
  siteId: string
  supplier?: string
  supportingDocument?: string
  lines: {
    description: string
    category: InventoryCategory
    quantity: number
    unit?: string
    unitPrice: number
  }[]
}

/**
 * Raises a purchase order. §8.2: *"Purchasing Agent raises a Purchase Order"*.
 *
 * Left as a DRAFT so it can be built up before anybody is asked to approve it; submitting is a
 * separate step, which is also where the value is measured against the threshold.
 */
export async function raiseOrder(actor: ProcurementActor, input: RaiseOrderInput) {
  if (input.lines.length === 0) throw ApiError.badRequest('A purchase order needs at least one line.')

  const lines: PurchaseOrderLine[] = input.lines.map((l) => ({
    description: l.description.trim(),
    category: l.category,
    quantity: l.quantity,
    unit: l.unit ?? 'unit',
    unitPrice: l.unitPrice,
    receivedQuantity: 0,
  }))

  const seq = await nextSequence('purchaseOrder')
  const order = new PurchaseOrder({
    _id: `po_${pad(seq)}`,
    ref: `PO-${pad(seq)}`,
    siteId: input.siteId,
    supplier: input.supplier ?? '',
    supportingDocument: input.supportingDocument ?? '',
    lines,
    total: totalOf(lines),
    status: 'DRAFT',
    raisedBy: actor.id,
    log: [],
  })
  log(order, 'RAISED', actor)
  await order.save()

  return order.toObject()
}

/**
 * Sends it for approval.
 *
 * Two things are settled here rather than at approval time: whether it counts as high-value,
 * and whether §8.2's veterinary documentation rule is satisfied. Both belong to the order as
 * submitted — an order should not change which rule it falls under while somebody considers it.
 */
export async function submitOrder(actor: ProcurementActor, id: string) {
  const rules = await rulesFor()
  const order = await PurchaseOrder.findById(id)
  if (!order) throw ApiError.notFound('No such purchase order.')
  if (order.status !== 'DRAFT') {
    throw ApiError.unprocessable(`${order.ref} has already been submitted.`)
  }

  order.total = totalOf(order.lines)

  /*
   * §8.2: *"Veterinary supply purchases require supporting documentation (vet prescription
   * where applicable)."*
   *
   * Enforced at submission because that is the last moment it is still cheap to fix — refusing
   * at approval would send it back to somebody who has stopped thinking about it.
   */
  const veterinary = order.lines.some((l) => l.category === 'VETERINARY_SUPPLIES')
  if (veterinary && !order.supportingDocument.trim()) {
    throw ApiError.badRequest('Veterinary supplies need supporting documentation before this can be submitted.', [
      'A prescription or equivalent reference, per §8.2.',
    ])
  }

  order.highValue = order.total >= rules.highValueThreshold
  order.status = 'AWAITING_APPROVAL'
  log(
    order,
    'SUBMITTED',
    actor,
    order.highValue
      ? `${order.total} is at or above the ${rules.highValueThreshold} threshold — needs ${rules.highValueApprovers.join(' or ')}`
      : `${order.total} is below the ${rules.highValueThreshold} threshold`,
  )
  await order.save()

  return order.toObject()
}

export async function approveOrder(actor: ProcurementActor, id: string, note = '') {
  const rules = await rulesFor()
  const order = await PurchaseOrder.findById(id)
  if (!order) throw ApiError.notFound('No such purchase order.')
  if (order.status !== 'AWAITING_APPROVAL') {
    throw ApiError.unprocessable(`${order.ref} is ${order.status.toLowerCase().replace(/_/g, ' ')}.`)
  }

  const allowed = approversFor(order, rules)
  if (!allowed.includes(actor.role)) {
    throw ApiError.forbidden(
      order.highValue
        ? `${order.ref} is a high-value order — this organisation has that set to ${allowed.join(' or ')}.`
        : `Your role does not approve purchase orders — this organisation has that set to ${allowed.join(' or ')}.`,
    )
  }

  if (!rules.selfApproval && order.raisedBy === actor.id) {
    throw ApiError.forbidden('The person who raised an order does not approve it.')
  }

  order.status = 'APPROVED'
  order.approvedBy = actor.id
  order.approvedAt = new Date()
  log(order, 'APPROVED', actor, note)
  await order.save()

  await recordAudit({
    tenantId: requireOrganisation(),
    actorId: actor.id,
    action: 'PURCHASE_ORDER_APPROVED',
    entity: 'PurchaseOrder',
    entityId: order._id,
    detail: `${order.ref} · ${order.total}`,
  })

  return order.toObject()
}

export async function rejectOrder(actor: ProcurementActor, id: string, reason: string) {
  if (!reason?.trim()) throw ApiError.badRequest('A rejected order needs a reason.')

  const rules = await rulesFor()
  const order = await PurchaseOrder.findById(id)
  if (!order) throw ApiError.notFound('No such purchase order.')
  if (order.status !== 'AWAITING_APPROVAL') {
    throw ApiError.unprocessable(`${order.ref} is not awaiting a decision.`)
  }
  if (!approversFor(order, rules).includes(actor.role)) {
    throw ApiError.forbidden('Your role does not decide purchase orders.')
  }

  order.status = 'REJECTED'
  log(order, 'REJECTED', actor, reason)
  await order.save()
  return order.toObject()
}

export interface ReceiptLine {
  index: number
  quantity: number
}

/**
 * Records a delivery. §8.2: *"receiving party confirms receipt with quantity verification"*.
 *
 * Quantities are counted per line rather than assumed, and a short delivery leaves the order
 * `PARTIALLY_RECEIVED` rather than closed — a supplier who sends eight of ten sacks has not
 * completed the order, and closing it would lose the two.
 */
export async function receiveOrder(actor: ProcurementActor, id: string, received: ReceiptLine[]) {
  const order = await PurchaseOrder.findById(id)
  if (!order) throw ApiError.notFound('No such purchase order.')
  if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
    throw ApiError.unprocessable(
      order.status === 'AWAITING_APPROVAL'
        ? `${order.ref} has not been approved yet.`
        : `${order.ref} is ${order.status.toLowerCase().replace(/_/g, ' ')}.`,
    )
  }

  for (const line of received) {
    const target = order.lines[line.index]
    if (!target) throw ApiError.badRequest(`${order.ref} has no line ${line.index + 1}.`)
    if (line.quantity < 0) throw ApiError.badRequest('A received quantity cannot be negative.')

    const total = target.receivedQuantity + line.quantity
    if (total > target.quantity) {
      throw ApiError.unprocessable(
        `${target.description}: ${total} received against ${target.quantity} ordered. Raise a new order for the extra rather than over-receiving this one.`,
      )
    }
    target.receivedQuantity = total
  }

  const complete = order.lines.every((l) => l.receivedQuantity >= l.quantity)
  order.status = complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
  if (complete) order.receivedAt = new Date()

  order.markModified('lines')
  log(order, complete ? 'RECEIVED' : 'PART_RECEIVED', actor)
  await order.save()

  await recordAudit({
    tenantId: requireOrganisation(),
    actorId: actor.id,
    action: complete ? 'PURCHASE_ORDER_RECEIVED' : 'PURCHASE_ORDER_PART_RECEIVED',
    entity: 'PurchaseOrder',
    entityId: order._id,
    detail: order.ref,
  })

  return order.toObject()
}

export async function cancelOrder(actor: ProcurementActor, id: string, reason: string) {
  const order = await PurchaseOrder.findById(id)
  if (!order) throw ApiError.notFound('No such purchase order.')
  if (['RECEIVED', 'CANCELLED'].includes(order.status)) {
    throw ApiError.unprocessable(`${order.ref} is already ${order.status.toLowerCase()}.`)
  }

  const rules = await rulesFor()
  const mayCancel =
    order.raisedBy === actor.id ||
    rules.standardApprovers.includes(actor.role) ||
    rules.highValueApprovers.includes(actor.role)
  if (!mayCancel) throw ApiError.forbidden('Only the person who raised an order, or an approver, can withdraw it.')

  order.status = 'CANCELLED'
  log(order, 'CANCELLED', actor, reason)
  await order.save()
  return order.toObject()
}

export async function listOrders(status?: string) {
  return PurchaseOrder.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()
}

/** The policy in force, so a screen can say who approves what before anybody tries. */
export async function procurementPolicy() {
  return rulesFor()
}
