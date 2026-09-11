import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useNow } from '@/hooks/useNow'
import { humanizeRemaining } from '@/utils'

const MS_PER_MIN = 60_000

/**
 * How long is left, in the three states a rental can actually be in.
 *
 * The distinction the desk cares about is between late and charged. A customer who is four
 * minutes past the hour owes nothing — that is what the grace period is for — but the clock
 * turned red and said OT the moment it crossed zero, so agents were telling people they were in
 * overtime while the platform was still charging them nothing, and the one moment that does cost
 * money looked no different from the four minutes that did not.
 *
 * So grace reads amber and says so, and red is kept for the state where a penalty is accruing.
 * `gracePeriodMin` is the tenant's own rule and comes from the session; without it the timer has
 * no grace to show and behaves as it always did.
 */
export function Timer({
  expectedEndAt,
  endedAt,
  gracePeriodMin = 0,
  className,
}: {
  expectedEndAt?: number | string | Date | null
  endedAt?: number | string | Date | null
  gracePeriodMin?: number | null
  className?: string
}) {
  const { t } = useTranslation('common')
  const now = useNow(1000)
  if (!expectedEndAt) return <span className={clsx('font-mono text-muted', className)}>—</span>

  const end = typeof expectedEndAt === 'number' ? expectedEndAt : new Date(expectedEndAt).getTime()
  const stoppedAt = endedAt ? (typeof endedAt === 'number' ? endedAt : new Date(endedAt).getTime()) : null
  const at = stoppedAt ?? now
  const remaining = end - at

  const graceMs = Math.max(0, gracePeriodMin ?? 0) * MS_PER_MIN
  const late = remaining < 0
  const withinGrace = late && -remaining <= graceMs
  const overtime = late && !withinGrace

  const phase = stoppedAt ? 'STOPPED' : overtime ? 'OVERTIME' : withinGrace ? 'GRACE' : 'RUNNING'

  return (
    <span
      className={clsx(
        'font-mono font-semibold tabular-nums',
        stoppedAt
          ? 'text-muted'
          : overtime
            ? 'text-danger-strong'
            : withinGrace || remaining < 45 * MS_PER_MIN
              ? 'text-amber-600'
              : 'text-success',
        className,
      )}
      data-testid="timer"
      data-phase={phase}
      data-overtime={overtime}
      data-grace={withinGrace}
      data-stopped={!!stoppedAt}
    >
      {overtime ? `${t('timer.overtime')} ` : withinGrace ? `${t('timer.grace')} ` : ''}
      {humanizeRemaining(remaining)}
      {stoppedAt ? ' · stopped' : ''}
    </span>
  )
}
