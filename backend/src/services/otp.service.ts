import { isWhatsAppConfigured, sendWhatsAppText } from './whatsapp.service.js'
import { isEmailConfigured, looksLikeEmail, otpEmail, sendEmail } from './email.service.js'
import { env } from '../config/env.js'
import type { OtpChannel, OtpDelivery, OtpIntent, SendOtpOptions } from '../interfaces/index.js'

interface Pending {
  code: string
  expiresAt: number
}
const store = new Map<string, Pending>()
const key = (destination: string, intent: OtpIntent) => `${intent}:${destination.trim().toLowerCase()}`

export function isChannelConfigured(channel: OtpChannel): boolean {
  return channel === 'EMAIL' ? isEmailConfigured() : isWhatsAppConfigured()
}

function assertDestinationMatchesChannel(channel: OtpChannel, destination: string): string | null {
  const value = destination.trim()
  if (channel === 'EMAIL') {
    return looksLikeEmail(value) ? null : `"${value}" is not a valid email address.`
  }
  return value.replace(/\D/g, '').length >= 6 ? null : `"${value}" is not a valid phone number.`
}

async function deliver(channel: OtpChannel, destination: string, code: string, options: SendOtpOptions) {
  if (channel === 'EMAIL') {
    return sendEmail({
      to: destination,
      ...otpEmail(code, { brand: env.MAIL_FROM_NAME, purpose: options.purpose, customerName: options.customerName }),
    })
  }
  return sendWhatsAppText(destination, `Your ${env.MAIL_FROM_NAME} verification code is ${code}. It expires in 5 minutes.`)
}

export async function sendOtp(
  destination: string,
  intent: OtpIntent,
  options: SendOtpOptions = {},
): Promise<{ delivered: OtpDelivery; channel: OtpChannel; code?: string; error?: string }> {
  const channel = options.channel ?? 'WHATSAPP'
  const allowMockFallback = options.allowMockFallback ?? true
  const mismatch = assertDestinationMatchesChannel(channel, destination)
  if (mismatch) return { delivered: 'FAILED', channel, error: mismatch }

  const code = String(Math.floor(1000 + Math.random() * 9000))
  store.set(key(destination, intent), { code, expiresAt: Date.now() + 5 * 60_000 })

  if (!isChannelConfigured(channel)) {
    const error = `${channel === 'EMAIL' ? 'Email' : 'WhatsApp'} provider is not configured.`
    return allowMockFallback ? { delivered: 'MOCK', channel, code } : { delivered: 'FAILED', channel, error }
  }

  const r = await deliver(channel, destination, code, options)
  return r.ok ? { delivered: channel, channel } : { delivered: 'FAILED', channel, error: r.error }
}

export function peekOtp(destination: string, intent: OtpIntent): string | null {
  return store.get(key(destination, intent))?.code ?? null
}

export function verifyOtp(destination: string, intent: OtpIntent, code: string): boolean {
  const k = key(destination, intent)
  const p = store.get(k)
  const ok = !!p && p.code === code.trim() && p.expiresAt > Date.now()
  if (ok) store.delete(k)
  return ok
}
