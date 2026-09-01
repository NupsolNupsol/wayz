export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function statusTone(status: string): Tone {
  const s = status.toUpperCase()
  if (['AVAILABLE', 'COMPLETED', 'PAID', 'CAPTURED', 'ACTIVE', 'RESOLVED', 'CLOSED', 'DELIVERED'].includes(s)) return 'success'
  if (['OVERTIME', 'LATE_ESCALATION', 'BLOCKED', 'OUT_OF_SERVICE', 'CANCELLED', 'REJECTED', 'MISSING_BAG', 'DAMAGED_BAG', 'WRONG_BAG'].includes(s)) return 'danger'
  if (['HELD', 'RESERVED', 'PENDING_FULFILMENT', 'PENDING_STORAGE', 'RETRIEVAL_IN_PROGRESS', 'RETRIEVAL_PENDING', 'RECONCILING', 'INVESTIGATING', 'AWAITING_APPROVAL', 'MAINTENANCE', 'INSPECTION_REQUIRED', 'DRAFT', 'REPORTED', 'REGISTERED', 'LABELLED'].includes(s)) return 'warning'
  if (['OCCUPIED', 'CONFIRMED', 'STORED', 'IN_TRANSIT'].includes(s)) return 'info'
  return 'neutral'
}
