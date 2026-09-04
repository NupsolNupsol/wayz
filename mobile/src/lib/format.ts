const CURRENCY = 'SAR'

export const money = (amount: number | null | undefined): string =>
  `${(amount ?? 0).toFixed(2)} ${CURRENCY}`

export const formatTime = (value: string | number | Date | null | undefined): string => {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const formatDate = (value: string | number | Date | null | undefined): string => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString([], { day: '2-digit', month: 'short' })
}

export const formatDateTime = (value: string | number | Date | null | undefined): string => {
  if (!value) return '—'
  return `${formatDate(value)} ${formatTime(value)}`
}

export function humanizeMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${seconds}s`
}

export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '—'
  const diff = now - new Date(value).getTime()
  const minutes = Math.floor(Math.abs(diff) / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return diff >= 0 ? `${minutes}m ago` : `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return diff >= 0 ? `${hours}h ago` : `in ${hours}h`
  const days = Math.floor(hours / 24)
  return diff >= 0 ? `${days}d ago` : `in ${days}d`
}

export const initials = (name: string | null | undefined): string =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`
