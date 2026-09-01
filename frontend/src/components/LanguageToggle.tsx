import { Languages } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/auth'
import { originFromEvent } from '@/lib/viewTransition'
import { LANGUAGES, type Language } from '@/i18n'

const SHORT: Record<Language, string> = { en: 'EN', ar: 'ع' }

/** Two letters, one tap. The whole platform turns over, including the direction it reads in. */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const language = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const current = (language ?? i18n.language) as Language

  if (compact) {
    const next: Language = current === 'en' ? 'ar' : 'en'
    return (
      <button
        onClick={(e) => setLanguage(next, originFromEvent(e))}
        data-testid="language-toggle"
        title={next === 'ar' ? t('header.switchToArabic') : t('header.switchToEnglish')}
        aria-label={next === 'ar' ? t('header.switchToArabic') : t('header.switchToEnglish')}
        className="px-2 py-2 rounded-lg text-muted hover:bg-black/5 flex items-center gap-1.5 text-sm font-bold"
      >
        <Languages size={18} />
        {SHORT[next]}
      </button>
    )
  }

  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-lg bg-canvas dark:bg-dk-elevated border border-line"
      data-testid="language-toggle"
      role="group"
      aria-label={t('header.language')}
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          onClick={(e) => setLanguage(code, originFromEvent(e))}
          data-testid={`language-${code}`}
          aria-pressed={current === code}
          className={clsx(
            'px-2.5 h-7 rounded-md text-xs font-bold transition-colors',
            current === code ? 'bg-brand text-brand-fg' : 'text-muted hover:text-brand',
          )}
        >
          {SHORT[code]}
        </button>
      ))}
    </div>
  )
}
