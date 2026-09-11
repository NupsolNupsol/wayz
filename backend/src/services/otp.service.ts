import { isChannelConfigured as isMessageChannelConfigured, sendText } from './vonage.service.js'
import { isEmailConfigured, looksLikeEmail, otpEmail, sendEmail } from './email.service.js'
import { env } from '../config/env.js'
import { otpWhatsApp } from '../constants/messages.constants.js'
import type { OtpChannel, OtpDelivery, OtpIntent, SendOtpOptions } from '../interfaces/index.js'

interface Pending {
  code: string
  expiresAt: number
}
const store = new Map<string, Pending>()
const key = (destination: string, intent: OtpIntent) => `${intent}:${destination.trim().toLowerCase()}`

export function isChannelConfigured(channel: OtpChannel): boolean {
  return channel === 'EMAIL' ? isEmailConfigured() : isMessageChannelConfigured(channel === 'SMS' ? 'sms' : 'whatsapp')
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
  // WhatsApp and SMS carry the same words to the same number; only the road differs.
  return sendText(channel === 'SMS' ? 'sms' : 'whatsapp', destination, otpWhatsApp(code, env.MAIL_FROM_NAME))
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
    const error = `${channel === 'EMAIL' ? 'Email' : channel === 'SMS' ? 'SMS' : 'WhatsApp'} provider is not configured.`
    return allowMockFallback ? { delivered: 'MOCK', channel, code } : { delivered: 'FAILED', channel, error }
  }

  const r = await deliver(channel, destination, code, options)
  return r.ok ? { delivered: channel, channel } : { delivered: 'FAILED', channel, error: r.error }
}

export function peekOtp(destination: string, intent: OtpIntent): string | null {
  return store.get(key(destination, intent))?.code ?? null
}

/**
 * The standing code a dev deployment will always accept.
 *
 * Two conditions, both required, and both server-side. A deployment that forgot to set MODE has
 * no such code; a dev deployment that set no code has none either. Read fresh on every call
 * rather than captured at import, so the answer always reflects what the server is actually
 * configured with.
 */
function standingCode(): string | null {
  if (env.MODE !== 'dev') return null
  const code = env.STATIC_OTP?.trim()
  return code ? code : null
}

export function isStaticOtpActive(): boolean {
  return standingCode() !== null
}

/**
 * Whether this code confirms this destination.
 *
 * A test team cannot read the phone the code was sent to, and on a dev server that turns every
 * scripted journey into a dead stop at the counter. So a dev deployment may hold one standing
 * code that is always accepted — *alongside* the real one, never instead of it, so the same
 * server still works for a person holding an actual handset.
 *
 * The standing code deliberately does not require a code to have been sent first: the send is
 * exactly the step that fails when there is no provider, and a fallback that still depends on it
 * would not unblock anything. Everything downstream is unchanged — the proof is recorded the same
 * way, against the same destination, so a run confirmed this way is indistinguishable afterwards.
 */
export function verifyOtp(destination: string, intent: OtpIntent, code: string): boolean {
  const k = key(destination, intent)
  const entered = code.trim()

  const standing = standingCode()
  if (standing && entered === standing) {
    store.delete(k)
    return true
  }

  const p = store.get(k)
  const ok = !!p && p.code === entered && p.expiresAt > Date.now()
  if (ok) store.delete(k)
  return ok
}
