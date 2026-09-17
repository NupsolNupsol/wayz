import i18n from '@/i18n'

export const CARD_SCHEMES = ['MADA', 'SPAN', 'VISA', 'MASTERCARD', 'GCC'] as const
export type CardScheme = (typeof CARD_SCHEMES)[number]

const ENGLISH: Record<CardScheme, string> = {
  MADA: 'Mada',
  SPAN: 'SPAN',
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  GCC: 'GCC',
}

export const schemeLabel = (scheme: CardScheme | string): string =>
  i18n.t(`status:scheme.${scheme}`, { defaultValue: ENGLISH[scheme as CardScheme] ?? String(scheme) })

export const schemeFullLabel = (scheme: CardScheme | string): string =>
  i18n.t(`status:schemeFull.${scheme}`, { defaultValue: `${schemeLabel(scheme)} Card` })
