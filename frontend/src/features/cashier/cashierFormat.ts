import i18n from '@/i18n'
import { ltr } from '@/utils'

export const money = (n: number) =>
  ltr(`${(n ?? 0).toFixed(2)} ${i18n.t('common:money.currency', { defaultValue: 'SAR' })}`)

/** "just now", "12 min", "2 h 6 min" — isolated so the parts stay in order in Arabic. */
export function waitedFor(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  if (mins < 1) return i18n.t('cashier:queue.justNow', { defaultValue: 'just now' })

  const minute = i18n.t('common:time.min', { defaultValue: 'min' })
  const hour = i18n.t('common:time.hour', { defaultValue: 'h' })

  if (mins < 60) return ltr(`${mins} ${minute}`)

  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return ltr(rest ? `${hours} ${hour} ${rest} ${minute}` : `${hours} ${hour}`)
}

export const STALE_QUEUE_MS = 10 * 60_000
