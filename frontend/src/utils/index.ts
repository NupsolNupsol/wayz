import { APP } from '@/config/appConfig'
import i18n from '@/i18n'

/**
 * Wraps a value in Unicode isolates so a figure keeps its own direction wherever it lands.
 * Without this, "1,063.94 SAR" comes out as "SAR 1,063.94" in an Arabic paragraph.
 */
export const ltr = (value: string): string => `\u2068${value}\u2069`

const currency = () => i18n.t('common:money.currency', { defaultValue: APP.currency })

let seq = 1000
export function uid(prefix = 'id'): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq}`
}

let refSeq = 100010
export function nextRef(prefix = ''): string {
  refSeq += 1
  return `${prefix}${refSeq}`
}

export function money(n: number): string {
  return ltr(`${n.toFixed(2)} ${currency()}`)
}

export function money0(n: number): string {
  return ltr(`${Math.round(n)} ${currency()}`)
}

export function splitVat(inclusive: number, rate = APP.vatRate) {
  const net = inclusive / (1 + rate)
  return { net, vat: inclusive - net }
}

export function delay<T>(value: T, ms = APP.serviceLatencyMs): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function fail(message: string, ms = APP.serviceLatencyMs): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
}

export function makeBarcode(): string {
  const base = Math.floor(100000000000 + Math.random() * 899999999999)
  return String(base)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** Arabic reads Gregorian dates with Arabic month names; the locale decides. */
const locale = () => (i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB')

export function formatTime(ts?: number | null): string {
  if (!ts) return '—'
  return ltr(new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }))
}

export function formatDateTime(ts?: number | null): string {
  if (!ts) return '—'
  return ltr(
    new Date(ts).toLocaleString(locale(), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  )
}

export function formatDate(ts?: number | null): string {
  if (!ts) return '—'
  return ltr(new Date(ts).toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' }))
}

/** A short axis label: "17 Aug" / "١٧ أغسطس". */
export function formatDayLabel(date: string | number | Date): string {
  return new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

export function humanizeRemaining(ms: number): string {
  const neg = ms < 0
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const s = Math.floor((abs % 60_000) / 1000)
  const core = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  return ltr(neg ? `-${core}` : core)
}
