import { clsx } from 'clsx'
import { useNow } from '@/hooks/useNow'
import { humanizeRemaining } from '@/utils'

export function Timer({ expectedEndAt, className }: { expectedEndAt?: number | string | Date | null; className?: string }) {
  const now = useNow(1000)
  if (!expectedEndAt) return <span className={clsx('font-mono text-muted', className)}>—</span>
  const end = typeof expectedEndAt === 'number' ? expectedEndAt : new Date(expectedEndAt).getTime()
  const remaining = end - now
  const overtime = remaining < 0
  return (
    <span
      className={clsx('font-mono font-semibold tabular-nums', overtime ? 'text-danger-strong' : remaining < 45 * 60_000 ? 'text-amber-600' : 'text-success', className)}
      data-testid="timer"
      data-overtime={overtime}
    >
      {overtime ? 'OT ' : ''}
      {humanizeRemaining(remaining)}
    </span>
  )
}
