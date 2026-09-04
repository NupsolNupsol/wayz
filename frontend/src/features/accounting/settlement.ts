import i18n from '@/i18n'
import { CARD_SCHEMES, schemeFullLabel } from '@/config/cardSchemes'

export { schemeFullLabel as schemeLabel }

export const schemeOptions = () => CARD_SCHEMES.map((value) => ({ label: schemeFullLabel(value), value }))

const ENGLISH_RECON: Record<string, string> = {
  MATCHED: 'Matched',
  AMOUNT_MISMATCH: 'Amount differs',
  SCHEME_MISMATCH: 'Card differs',
  MISSING_IN_PLATFORM: 'Only at the terminal',
  MISSING_AT_TERMINAL: 'Only in the platform',
}

export const reconLabel = (outcome: string): string =>
  i18n.t(`status:reconciliation.${outcome}`, { defaultValue: ENGLISH_RECON[outcome] ?? outcome.replaceAll('_', ' ') })

export const RECON_TONES: Record<string, 'success' | 'warning' | 'danger'> = {
  MATCHED: 'success',
  AMOUNT_MISMATCH: 'warning',
  SCHEME_MISMATCH: 'warning',
  MISSING_IN_PLATFORM: 'danger',
  MISSING_AT_TERMINAL: 'danger',
}

export const money = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`

export function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
