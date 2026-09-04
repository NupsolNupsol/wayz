import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { RefreshCw } from 'lucide-react'
import { useNow } from '@/hooks/useNow'
import { sinceLabel } from '@/utils'

export function LiveIndicator({ updatedAt, fetching }: { updatedAt?: number; fetching?: boolean }) {
  const { t } = useTranslation('common')
  useNow(10_000)

  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" data-testid="live-indicator">
      <RefreshCw size={13} className={clsx('text-brand', fetching && 'animate-spin')} />
      <span className="hidden sm:inline">
        {updatedAt ? t('live.updated', { when: sinceLabel(updatedAt) }) : t('live.live')}
      </span>
    </span>
  )
}
