import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import type { WhatsAppResult } from '../interfaces/index.js'

export function isWhatsAppConfigured(): boolean {
  return !!(env.VONAGE_API_KEY && env.VONAGE_API_SECRET && env.VONAGE_WHATSAPP_NUMBER)
}

export function toDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function maskPhone(phone: string): string {
  const digits = toDigits(phone)
  if (digits.length < 4) return '••••'
  return `${'•'.repeat(Math.max(2, digits.length - 4))}${digits.slice(-4)}`
}

async function send(phone: string, message: Record<string, unknown>): Promise<WhatsAppResult> {
  if (!isWhatsAppConfigured()) return { ok: false, error: 'WhatsApp provider is not configured.' }

  const auth = Buffer.from(`${env.VONAGE_API_KEY}:${env.VONAGE_API_SECRET}`).toString('base64')
  try {
    const res = await fetch(env.VONAGE_MESSAGES_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: toDigits(env.VONAGE_WHATSAPP_NUMBER!),
        to: toDigits(phone),
        channel: 'whatsapp',
        ...message,
      }),
    })
    const body = await res.text().catch(() => '')
    if (!res.ok) {
      logger.warn('WhatsApp send failed', { status: res.status, to: maskPhone(phone), body: body.slice(0, 300) })
      return { ok: false, error: `Vonage responded ${res.status}: ${body.slice(0, 300)}` }
    }
    logger.info('WhatsApp sent', { to: maskPhone(phone), kind: message.message_type })
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.warn('WhatsApp send errored', { to: maskPhone(phone), error })
    return { ok: false, error }
  }
}

export async function sendWhatsAppText(phone: string, text: string): Promise<WhatsAppResult> {
  return send(phone, { message_type: 'text', text })
}

export async function sendWhatsAppFile(
  phone: string,
  file: { url: string; caption?: string },
): Promise<WhatsAppResult> {
  return send(phone, { message_type: 'file', file })
}

export function isPubliclyFetchable(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local') || host === '::1') return false
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    return true
  } catch {
    return false
  }
}
