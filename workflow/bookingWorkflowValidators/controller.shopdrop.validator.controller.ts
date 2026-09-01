import type { ValidationResult, WorkflowContext } from '../shared/types.js'
import { BAG_DELIVERED, BAG_RETRIEVED } from '../shared/status.js'
import {
  requireHeldUnitUsable,
  requireIdentityVerified,
  requirePositiveDuration,
  requireReason,
  requireTargetUnitAvailable,
} from './shared.validators.js'

function validateBagScans(ctx: WorkflowContext): string[] {
  const registered = ctx.booking.bags
  if (!registered.length) return ['This booking has no registered bags to store.']

  const raw = ctx.payload.scannedBarcodes
  if (!Array.isArray(raw) || raw.length === 0) {
    return ['No bag scans were submitted — scan every bag into the compartment.']
  }

  const scans = raw.map((s) => String(s).trim()).filter(Boolean)
  const known = new Set(registered.map((b) => b.barcode))
  const errors: string[] = []

  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const s of scans) {
    if (seen.has(s)) duplicates.add(s)
    seen.add(s)
  }
  if (duplicates.size) {
    errors.push(`Duplicate scan(s): ${[...duplicates].join(', ')} — scan each bag exactly once.`)
  }

  const foreign = [...seen].filter((s) => !known.has(s))
  if (foreign.length) {
    errors.push(`Wrong bag — ${foreign.length} scanned barcode(s) do not belong to this booking: ${foreign.join(', ')}.`)
  }

  const missing = registered.filter((b) => !seen.has(b.barcode))
  if (missing.length) {
    errors.push(
      `${missing.length} bag(s) not scanned (${missing.map((b) => `Bag ${b.index}`).join(', ')}) — scan every bag before continuing.`,
    )
  }

  return errors
}

function validateCompartmentScan(ctx: WorkflowContext): string[] {
  const expected = ctx.booking.reservation?.assetUnitId ?? ctx.booking.assetUnitId
  if (!expected) return ['No compartment is reserved for this booking.']

  const scanned = typeof ctx.payload.scannedUnitId === 'string' ? ctx.payload.scannedUnitId.trim() : ''
  if (!scanned) return ['Scan the compartment before confirming storage.']
  if (scanned !== expected) {
    return ['Scanned compartment does not match the reserved unit — do not store the bags here.']
  }
  return []
}

function validateAllBagsRetrieved(ctx: WorkflowContext): string[] {
  const notOut = ctx.booking.bags.filter((b) => b.status !== BAG_RETRIEVED && b.status !== BAG_DELIVERED)
  return notOut.length ? [`Cannot complete — ${notOut.length} bag(s) not yet scanned out.`] : []
}

export const useShopDropValidator = (transitionCode: string, ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      break
    }

    case 'TO_RESERVED': {
      break
    }

    case 'TO_REASSIGNED': {
      errors.push(...requireReason(ctx), ...requireTargetUnitAvailable(ctx))
      break
    }

    case 'TO_STORED': {
      errors.push(
        ...validateCompartmentScan(ctx),
        ...requireHeldUnitUsable(ctx),
        ...validateBagScans(ctx),
        ...requirePositiveDuration(ctx),
      )
      break
    }

    case 'TO_RETRIEVAL': {
      errors.push(...requireIdentityVerified(ctx, 'RETRIEVAL'))
      break
    }

    case 'TO_COMPLETED': {
      errors.push(...validateAllBagsRetrieved(ctx))
      break
    }

    case 'TO_CANCELLED': {
      break
    }

    default: {
      errors.push(`Unknown transition code: ${transitionCode}`)
      break
    }
  }

  return { errors }
}
