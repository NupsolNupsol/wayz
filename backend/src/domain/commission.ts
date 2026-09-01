import { round2 } from '../utils/helpers.js'

export const CARD_SCHEMES = ['MADA', 'SPAN', 'VISA', 'MASTERCARD', 'GCC'] as const
export type CardScheme = (typeof CARD_SCHEMES)[number]

export const DEFAULT_COMMISSION_RATES: Record<CardScheme, number> = {
  MADA: 0.0075,
  SPAN: 0.0075,
  VISA: 0.026,
  MASTERCARD: 0.026,
  GCC: 0.0175,
}

export const MAX_COMMISSION_RATE = 0.2

export interface CommissionSplit {
  grossAmount: number
  commissionRate: number
  commissionAmount: number
  netSettled: number
}

export function commissionOn(grossAmount: number, commissionRate: number): CommissionSplit {
  const gross = round2(grossAmount)
  const commissionAmount = round2(gross * commissionRate)
  return {
    grossAmount: gross,
    commissionRate,
    commissionAmount,
    netSettled: round2(gross - commissionAmount),
  }
}

export function isCardScheme(value: string): value is CardScheme {
  return (CARD_SCHEMES as readonly string[]).includes(value)
}

const SCHEME_ALIASES: Record<string, CardScheme> = {
  MADA: 'MADA',
  'MADA CARD': 'MADA',
  MADACARD: 'MADA',
  SPAN: 'SPAN',
  'SPAN CARD': 'SPAN',
  VISA: 'VISA',
  'VISA CARD': 'VISA',
  MASTERCARD: 'MASTERCARD',
  'MASTER CARD': 'MASTERCARD',
  MASTER: 'MASTERCARD',
  MC: 'MASTERCARD',
  GCC: 'GCC',
  'GCC CARD': 'GCC',
}

export function normaliseScheme(value: string): CardScheme | null {
  const key = value?.trim().toUpperCase().replaceAll('_', ' ')
  return SCHEME_ALIASES[key] ?? SCHEME_ALIASES[key?.replaceAll(' ', '')] ?? null
}
