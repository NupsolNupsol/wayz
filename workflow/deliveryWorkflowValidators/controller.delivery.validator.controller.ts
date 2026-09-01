import type { DeliveryContext, ValidationResult } from '../shared/types.js'
import { DLV_PICKED_UP, DLV_RELEASE_APPROVED } from '../shared/status.js'

const CODE_TTL_NOTE = 'The compartment code has expired — ask the kiosk agent to approve again.'

export const useDeliveryValidator = (transitionCode: string, ctx: DeliveryContext): ValidationResult => {
  const errors: string[] = []
  const { delivery, actor, payload, now } = ctx

  const mustBeAssignee = () => {
    if (!delivery.assignedTo) {
      errors.push('This delivery has not been claimed yet.')
      return
    }
    if (delivery.assignedTo !== actor.id) {
      errors.push('This delivery is assigned to another courier.')
    }
  }

  switch (transitionCode) {
    case 'TO_ASSIGNED': {
      if (delivery.assignedTo && delivery.assignedTo !== actor.id) {
        errors.push('Another courier claimed this delivery first.')
      }
      break
    }

    case 'TO_RELEASE_REQUESTED': {
      mustBeAssignee()
      break
    }

    case 'TO_RELEASE_APPROVED': {
      if (!delivery.assignedTo) {
        errors.push('Nobody is assigned to this delivery.')
        break
      }
      const confirming = typeof payload.confirmCourierId === 'string' ? payload.confirmCourierId : ''
      if (!confirming) {
        errors.push('Confirm which courier is collecting before approving.')
      } else if (confirming !== delivery.assignedTo) {
        errors.push('That is not the courier this delivery is assigned to — do not release the bags.')
      }

      const code = String(payload.compartmentCode ?? '').trim()
      if (!code) errors.push('Type the compartment code so the courier can open it.')
      else if (!/^[A-Za-z0-9]{4,12}$/.test(code)) errors.push('A compartment code is 4–12 letters or digits.')
      break
    }

    case 'TO_PICKED_UP': {
      mustBeAssignee()

      if (!delivery.compartmentCode) {
        errors.push('No compartment code has been issued yet.')
      } else if (delivery.compartmentCodeExpiresAt && new Date(delivery.compartmentCodeExpiresAt).getTime() < now.getTime()) {
        errors.push(CODE_TTL_NOTE)
      }

      const registered = ctx.bags
      if (!registered.length) {
        errors.push('This booking has no bags to collect.')
        break
      }

      const raw = payload.scannedBarcodes
      if (!Array.isArray(raw) || raw.length === 0) {
        errors.push('Scan every bag before leaving the kiosk.')
        break
      }

      const scans = raw.map((s) => String(s).trim()).filter(Boolean)
      const known = new Set(registered.map((b) => b.barcode))

      const seen = new Set<string>()
      const duplicates = new Set<string>()
      for (const s of scans) {
        if (seen.has(s)) duplicates.add(s)
        seen.add(s)
      }
      if (duplicates.size) errors.push(`Duplicate scan(s): ${[...duplicates].join(', ')} — scan each bag once.`)

      const foreign = [...seen].filter((s) => !known.has(s))
      if (foreign.length) {
        errors.push(`Wrong bag — ${foreign.length} barcode(s) do not belong to this customer: ${foreign.join(', ')}.`)
      }

      const missing = registered.filter((b) => !seen.has(b.barcode))
      if (missing.length) {
        errors.push(`${missing.length} bag(s) not scanned (${missing.map((b) => `Bag ${b.index}`).join(', ')}).`)
      }
      break
    }

    case 'TO_DELIVERED': {
      mustBeAssignee()
      if (delivery.status !== DLV_PICKED_UP) errors.push('Collect the bags from the kiosk first.')
      break
    }

    case 'TO_FAILED': {
      mustBeAssignee()
      if (!String(payload.reason ?? '').trim()) errors.push('Record why the delivery could not be completed.')
      break
    }

    case 'TO_CANCELLED': {
      if (!String(payload.reason ?? '').trim()) errors.push('A reason is required to cancel a delivery.')
      if (([DLV_RELEASE_APPROVED, DLV_PICKED_UP] as string[]).includes(delivery.status)) {
        errors.push('The bags are already released — close this as delivered or failed instead.')
      }
      break
    }

    default: {
      errors.push(`Unknown transition code: ${transitionCode}`)
      break
    }
  }

  return { errors }
}
