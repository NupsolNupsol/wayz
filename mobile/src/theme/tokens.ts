import { Platform } from 'react-native'

/**
 * The single source of truth for colour, elevation and rhythm.
 *
 * The web workspace is the brand: deep navy for authority, teal for action. Screens are built from
 * these tokens rather than literal hex values so a brand change is one edit, and so the kiosk and
 * courier apps cannot drift apart.
 */

export const COLORS = {
  brand: '#14b8a6',
  brandDark: '#0f766e',
  brandDeep: '#0b5f59',
  brandSoft: '#e0f7f4',
  navy: '#0f214a',
  navySoft: '#1e3a6b',
  navyDeep: '#081533',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  canvas: '#f4f7fa',
  surface: '#ffffff',
  success: '#16a34a',
  warn: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  violet: '#7c3aed',
  white: '#ffffff',
} as const

/** Header washes. Two stops each — the third is only there to keep the fade from banding. */
export const GRADIENTS = {
  /** The courier's home. Navy into teal: night shift into the work of the day. */
  courier: [COLORS.navyDeep, COLORS.navy, '#124a63'] as const,
  /** The kiosk counter. Teal-led, because selling is the action. */
  kiosk: ['#0d3b52', COLORS.navy, COLORS.brandDeep] as const,
  brand: [COLORS.brandDark, COLORS.brand] as const,
  navy: [COLORS.navyDeep, COLORS.navySoft] as const,
  slate: ['#1e293b', '#334155'] as const,
} as const

export type GradientName = keyof typeof GRADIENTS

/**
 * Elevation, written once per platform.
 *
 * iOS wants a shadow object, Android an elevation number, and React Native Web deprecated both in
 * favour of `boxShadow`. Building them here keeps the choice out of every component and stops the
 * web build filling the console with deprecation warnings.
 */
type Elevation = { y: number; blur: number; opacity: number; android: number }

const LEVELS = {
  card: { y: 4, blur: 12, opacity: 0.06, android: 2 },
  pop: { y: 8, blur: 20, opacity: 0.12, android: 6 },
  float: { y: 10, blur: 24, opacity: 0.2, android: 12 },
} as const satisfies Record<string, Elevation>

const SHADOW_RGB = '15, 33, 74'

function elevation(level: Elevation) {
  if (Platform.OS === 'web') {
    return { boxShadow: `0px ${level.y}px ${level.blur}px rgba(${SHADOW_RGB}, ${level.opacity})` } as const
  }
  return {
    shadowColor: '#0f214a',
    shadowOpacity: level.opacity,
    shadowRadius: level.blur,
    shadowOffset: { width: 0, height: level.y },
    elevation: level.android,
  } as const
}

export const SHADOW = {
  card: elevation(LEVELS.card),
  pop: elevation(LEVELS.pop),
  float: elevation(LEVELS.float),
}

export type Tone = 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'violet' | 'neutral'

/** A tone resolved to the four places it is used: a tinted box, its border, its text, its dot. */
export const TONE_CLASS: Record<Tone, { box: string; border: string; text: string; dot: string }> = {
  brand: { box: 'bg-brand-soft', border: 'border-brand/30', text: 'text-brand-ink', dot: 'bg-brand' },
  success: { box: 'bg-success-soft', border: 'border-success/30', text: 'text-success', dot: 'bg-success' },
  warn: { box: 'bg-warn-soft', border: 'border-warn/30', text: 'text-warn', dot: 'bg-warn' },
  danger: { box: 'bg-danger-soft', border: 'border-danger/30', text: 'text-danger', dot: 'bg-danger' },
  info: { box: 'bg-info-soft', border: 'border-info/30', text: 'text-info', dot: 'bg-info' },
  violet: { box: 'bg-violet-soft', border: 'border-violet/30', text: 'text-violet', dot: 'bg-violet' },
  neutral: { box: 'bg-canvas', border: 'border-line', text: 'text-muted', dot: 'bg-faint' },
}

export const TONE_HEX: Record<Tone, string> = {
  brand: COLORS.brand,
  success: COLORS.success,
  warn: COLORS.warn,
  danger: COLORS.danger,
  info: COLORS.info,
  violet: COLORS.violet,
  neutral: COLORS.muted,
}

const STATUS_TONE: Record<string, Tone> = {
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
  REGISTERED: 'neutral',
  LABELLED: 'info',
  STORED: 'success',
  IN_TRANSIT: 'warn',
  RETRIEVED: 'neutral',
  DELIVERED: 'success',
  AVAILABLE: 'success',
  HELD: 'warn',
  OCCUPIED: 'info',
  RETRIEVAL_PENDING: 'warn',
  INSPECTION_REQUIRED: 'warn',
  BLOCKED: 'danger',
  OUT_OF_SERVICE: 'danger',
  MAINTENANCE: 'warn',
  REQUESTED: 'warn',
  ASSIGNED: 'info',
  RELEASE_REQUESTED: 'warn',
  RELEASE_APPROVED: 'brand',
  PICKED_UP: 'info',
  FAILED: 'danger',
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

export const humanise = (code: string | null | undefined): string => {
  if (!code) return '—'
  const words = code.replaceAll('_', ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
