import i18n from '@/i18n'

/**
 * The name to put on screen for something that has been given an Arabic one.
 *
 * A tenant types a product's name twice — once in English, once in Arabic — and an agent working
 * in Arabic should read the Arabic one. Anything without an Arabic name falls back to what it has,
 * so a half-translated price list still reads sensibly rather than showing blanks.
 *
 * Deliberately not a hook: names are rendered inside table column definitions and `.map()` bodies
 * where a hook cannot go. It reads `i18n.language`, and every screen re-renders on a language
 * change, so the value is never stale.
 */
export function localName(
  record: { name?: string | null; nameAr?: string | null } | null | undefined,
  language: string = i18n.language,
): string {
  if (!record) return ''
  const arabic = language.startsWith('ar')
  const preferred = arabic ? record.nameAr : record.name
  return (preferred || record.name || record.nameAr || '').trim()
}

/**
 * The same choice for a name already written onto a booking or an order line, where the two
 * spellings are stored side by side rather than on a product.
 */
export function localBaked(
  record: { productName?: string | null; productNameAr?: string | null } | null | undefined,
  language: string = i18n.language,
): string {
  if (!record) return ''
  const arabic = language.startsWith('ar')
  const preferred = arabic ? record.productNameAr : record.productName
  return (preferred || record.productName || record.productNameAr || '').trim()
}
