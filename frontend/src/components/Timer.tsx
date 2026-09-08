import { clsx } from 'clsx'
import { useNow } from '@/hooks/useNow'
import { humanizeRemaining } from '@/utils'

export function Timer({
  expectedEndAt,
  endedAt,
  className,
}: {
  expectedEndAt?: number | string | Date | null
  endedAt?: number | string | Date | null
  className?: string
}) {
  const now = useNow(1000)
  if (!expectedEndAt) return <span className={clsx('font-mono text-muted', className)}>—</span>

  const end = typeof expectedEndAt === 'number' ? expectedEndAt : new Date(expectedEndAt).getTime()
  const stoppedAt = endedAt ? (typeof endedAt === 'number' ? endedAt : new Date(endedAt).getTime()) : null
  const at = stoppedAt ?? now
  const remaining = end - at
  const overtime = remaining < 0

  return (
    <span
      className={clsx(
        'font-mono font-semibold tabular-nums',
        stoppedAt ? 'text-muted' : overtime ? 'text-danger-strong' : remaining < 45 * 60_000 ? 'text-amber-600' : 'text-success',
        className,
      )}
      data-testid="timer"
      data-overtime={overtime}
      data-stopped={!!stoppedAt}
    >
      {overtime ? 'OT ' : ''}
      {humanizeRemaining(remaining)}
      {stoppedAt ? ' · stopped' : ''}
    </span>
  )
}
