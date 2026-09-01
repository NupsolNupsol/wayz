/**
 * The few places that need a colour as a value rather than a class: the status bar, an
 * ActivityIndicator, a chart bar, a native header. Everything else uses Tailwind classes.
 */
export const COLORS = {
  brand: '#14b8a6',
  brandDark: '#0f766e',
  brandSoft: '#e0f7f4',
  navy: '#0f214a',
  navySoft: '#1e3a6b',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  canvas: '#f7f9fb',
  surface: '#ffffff',
  success: '#16a34a',
  warn: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  white: '#ffffff',
} as const

export type Tone = 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'neutral'

/** One tone table, so a pill, a banner and a stat all agree on what "late" looks like. */
export const TONE_CLASS: Record<Tone, { box: string; border: string; text: string; dot: string }> = {
  brand: { box: 'bg-brand-soft', border: 'border-brand/30', text: 'text-brand-ink', dot: 'bg-brand' },
  success: { box: 'bg-success-soft', border: 'border-success/30', text: 'text-success', dot: 'bg-success' },
  warn: { box: 'bg-warn-soft', border: 'border-warn/30', text: 'text-warn', dot: 'bg-warn' },
  danger: { box: 'bg-danger-soft', border: 'border-danger/30', text: 'text-danger', dot: 'bg-danger' },
  info: { box: 'bg-info-soft', border: 'border-info/30', text: 'text-info', dot: 'bg-info' },
  neutral: { box: 'bg-canvas', border: 'border-line', text: 'text-muted', dot: 'bg-faint' },
}

/**
 * Booking, bag, unit and delivery states all land in one of these tones. The workflow owns
 * the states; this only decides how urgent each one looks.
 */
const STATUS_TONE: Record<string, Tone> = {
  // bookings
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  RESERVED: 'info',
  ACTIVE: 'success',
  OVERTIME: 'danger',
  RETRIEVAL_IN_PROGRESS: 'warn',
  PREPARING: 'info',
  SERVED: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
  // bags
  REGISTERED: 'neutral',
  LABELLED: 'info',
  STORED: 'success',
  IN_TRANSIT: 'warn',
  RETRIEVED: 'neutral',
  DELIVERED: 'neutral',
  // units
  AVAILABLE: 'success',
  HELD: 'warn',
  OCCUPIED: 'info',
  RETRIEVAL_PENDING: 'warn',
  INSPECTION_REQUIRED: 'warn',
  BLOCKED: 'danger',
  OUT_OF_SERVICE: 'danger',
  MAINTENANCE: 'warn',
  // deliveries
  REQUESTED: 'warn',
  ASSIGNED: 'info',
  RELEASE_REQUESTED: 'warn',
  RELEASE_APPROVED: 'info',
  PICKED_UP: 'info',
  FAILED: 'danger',
  // shifts, payments, incidents
  OPEN: 'success',
  COUNTED: 'info',
  AWAITING_APPROVAL: 'warn',
  CLOSED: 'neutral',
  CAPTURED: 'success',
  PENDING: 'warn',
  REFUNDED: 'warn',
  REPORTED: 'warn',
  INVESTIGATING: 'info',
  RESOLVED: 'success',
  REJECTED: 'neutral',
}

export const toneFor = (status: string | null | undefined): Tone =>
  (status && STATUS_TONE[status.toUpperCase()]) || 'neutral'

/** `RETRIEVAL_IN_PROGRESS` → `Retrieval in progress`. */
export const humanise = (code: string | null | undefined): string => {
  if (!code) return '—'
  const words = code.replaceAll('_', ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
