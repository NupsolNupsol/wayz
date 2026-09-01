import i18n from '@/i18n'

/** The server sends both languages for ledger labels; this picks the reader's. */
export function bilingual(label: { en: string; ar: string } | undefined): string {
  if (!label) return ''
  return i18n.language === 'ar' && label.ar ? label.ar : label.en
}
