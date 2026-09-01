import type { DeliveryContext, DeliveryOperationResult, DeliverySnapshot } from '../shared/types.js'
import type { BagItemStatus, DeliveryStatus } from '../shared/status.js'
import {
  BAG_DELIVERED,
  BAG_IN_TRANSIT,
  DLV_ASSIGNED,
  DLV_CANCELLED,
  DLV_DELIVERED,
  DLV_FAILED,
  DLV_PICKED_UP,
  DLV_RELEASE_APPROVED,
  DLV_RELEASE_REQUESTED,
  UNIT_AVAILABLE,
} from '../shared/status.js'

const CODE_TTL_MINUTES = 15

function begin(ctx: DeliveryContext): DeliveryOperationResult {
  return {
    errors: [],
    delivery: JSON.parse(JSON.stringify(ctx.delivery)) as DeliverySnapshot,
    assetIntents: [],
    audits: [],
  }
}

function advance(result: DeliveryOperationResult, ctx: DeliveryContext, status: DeliveryStatus, note?: string) {
  result.delivery.status = status
  result.delivery.timeline.push({ status, at: ctx.now.toISOString(), by: ctx.actor.id, note })
}

export const useDeliveryOperation = (transitionCode: string, ctx: DeliveryContext): DeliveryOperationResult => {
  const result = begin(ctx)
  const { actor, payload, now } = ctx

  switch (transitionCode) {
    case 'TO_ASSIGNED': {
      result.delivery.assignedTo = actor.id
      result.delivery.assignedAt = now.toISOString()
      advance(result, ctx, DLV_ASSIGNED, 'Claimed by courier')
      result.audits.push({ action: 'DELIVERY_CLAIMED', detail: result.delivery.ref })
      break
    }

    case 'TO_RELEASE_REQUESTED': {
      const again = !!result.delivery.releaseApprovedAt
      result.delivery.releaseRequestedAt = now.toISOString()
      result.delivery.compartmentCode = null
      result.delivery.compartmentCodeExpiresAt = null
      advance(
        result,
        ctx,
        DLV_RELEASE_REQUESTED,
        again ? 'Courier asked again — the previous code expired' : 'Courier at the kiosk requesting the bags',
      )
      break
    }

    case 'TO_RELEASE_APPROVED': {
      result.delivery.releaseApprovedBy = actor.id
      result.delivery.releaseApprovedAt = now.toISOString()
      result.delivery.compartmentCode = String(payload.compartmentCode ?? '').trim()
      result.delivery.compartmentCodeExpiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString()
      advance(result, ctx, DLV_RELEASE_APPROVED, 'Kiosk agent confirmed the courier and released the compartment')
      result.audits.push({
        action: 'DELIVERY_RELEASE_APPROVED',
        detail: `${result.delivery.ref} → courier ${result.delivery.assignedTo}`,
      })
      break
    }

    case 'TO_PICKED_UP': {
      const scanned = (payload.scannedBarcodes as string[] | undefined) ?? []
      result.delivery.scannedBarcodes = scanned.map((s) => String(s).trim())
      result.delivery.pickedUpAt = now.toISOString()
      result.delivery.compartmentCode = null
      result.delivery.compartmentCodeExpiresAt = null
      advance(result, ctx, DLV_PICKED_UP, `${scanned.length} bag(s) collected`)

      const unitId = typeof payload.assetUnitId === 'string' ? payload.assetUnitId : ''
      if (unitId) {
        result.assetIntents.push({ op: 'SET_STATUS', unitId, status: UNIT_AVAILABLE, currentBookingId: null })
      }
      result.audits.push({ action: 'DELIVERY_PICKED_UP', detail: `${result.delivery.ref} · ${scanned.length} bag(s)` })
      break
    }

    case 'TO_DELIVERED': {
      result.delivery.deliveredAt = now.toISOString()
      advance(result, ctx, DLV_DELIVERED, String(payload.note ?? 'Handed to the customer'))
      result.audits.push({ action: 'DELIVERY_COMPLETED', detail: result.delivery.ref })
      break
    }

    case 'TO_FAILED': {
      const reason = String(payload.reason ?? '').trim()
      result.delivery.failureReason = reason
      advance(result, ctx, DLV_FAILED, reason)
      result.audits.push({ action: 'DELIVERY_FAILED', detail: result.delivery.ref, reason })
      break
    }

    case 'TO_CANCELLED': {
      const reason = String(payload.reason ?? '').trim()
      result.delivery.failureReason = reason
      result.delivery.compartmentCode = null
      result.delivery.compartmentCodeExpiresAt = null
      advance(result, ctx, DLV_CANCELLED, reason)
      result.audits.push({ action: 'DELIVERY_CANCELLED', detail: result.delivery.ref, reason })
      break
    }

    default: {
      result.errors.push(`Unknown transition code: ${transitionCode}`)
      break
    }
  }

  return result
}

export function bagStatusFor(transitionCode: string): BagItemStatus | null {
  if (transitionCode === 'TO_PICKED_UP') return BAG_IN_TRANSIT
  if (transitionCode === 'TO_DELIVERED') return BAG_DELIVERED
  return null
}
