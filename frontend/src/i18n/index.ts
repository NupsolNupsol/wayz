import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import ar from './locales/ar'
import en from './locales/en'

export const LANGUAGES = ['en', 'ar'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_LABEL: Record<Language, string> = { en: 'English', ar: 'العربية' }

/** The one place that knows Arabic reads right to left. */
export const directionOf = (language: Language): 'ltr' | 'rtl' => (language === 'ar' ? 'rtl' : 'ltr')

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)

void i18n.use(initReactI18next).init({
  resources: { en, ar },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  // The screens are trusted source, and React escapes for us.
  interpolation: { escapeValue: false },
  returnNull: false,
})

/**
 * Puts the language on the document so CSS, the browser and assistive tech all agree.
 * Tailwind's logical utilities key off `dir`, which is what flips the layout.
 */
export function applyLanguage(language: Language): void {
  const html = document.documentElement
  html.setAttribute('lang', language)
  html.setAttribute('dir', directionOf(language))
  if (i18n.language !== language) void i18n.changeLanguage(language)
}

export default i18n
