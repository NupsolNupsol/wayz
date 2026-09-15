import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

import { learningApi } from '@/api/learning.api'
import { useAssistantUi } from './assistantUi'
import { AssistantPanel } from './AssistantPanel'

/**
 * The floating button, and the panel it opens.
 *
 * Unobtrusive by design: one small circle on the inside edge, above the content but below
 * modals, and nothing else until somebody asks for it.
 *
 * It hides itself entirely when the server says the assistant is not configured. Offering a
 * button that can only produce an error is worse than offering nothing, and this is the one
 * check that decides it — the capability is asked once per session and cached.
 */
export function AssistantLauncher() {
  const { t } = useTranslation('assistant')
  const { open, setOpen } = useAssistantUi()

  const capability = useQuery({
    queryKey: ['learning', 'capability'],
    queryFn: learningApi.capability,
    staleTime: 10 * 60_000,
    retry: false,
  })

  if (!capability.data?.enabled) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="assistant-launcher"
          aria-label={t('title')}
          title={t('title')}
          className="fixed bottom-5 end-5 z-[1500] h-12 rounded-pill bg-brand text-brand-fg shadow-pop hover:shadow-cardhover transition-all flex items-center gap-2 px-4 print:hidden"
        >
          <Sparkles size={18} className="shrink-0" />
          <span className="text-sm font-semibold hidden sm:inline">{t('title')}</span>
        </button>
      )}
      <AssistantPanel />
    </>
  )
}
