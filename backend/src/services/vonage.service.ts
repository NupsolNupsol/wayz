import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import type { WhatsAppResult } from '../interfaces/index.js'

/**
 * Vonage's Messages API, which carries both WhatsApp and SMS.
 *
 * One endpoint, one set of credentials, one difference: the channel and the sender it
 * goes out from. Keeping that difference in a single place is why adding SMS did not mean
 * a second copy of the retry, timeout, masking and error handling.
 *
 * SMS matters for a real reason rather than as a nice-to-have — the specification notes
 * that a customer's WhatsApp number is not always the number they answer calls on, so a
 * code that only ever goes to WhatsApp reaches nobody.
 */

export type MessageChannel = 'whatsapp' | 'sms'

/**
 * How long the counter will wait for the provider.
 *
 * There is an agent holding a phone and a customer waiting on a code. If Vonage is slow
 * or unreachable the request used to hang on the default socket timeout — minutes, in
 * practice — and the desk simply froze.
 */
const PROVIDER_TIMEOUT_MS = 10_000

export function toDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function maskPhone(phone: string): string {
  const digits = toDigits(phone)
  if (digits.length < 4) return '••••'
  return `${'•'.repeat(Math.max(2, digits.length - 4))}${digits.slice(-4)}`
}

const hasCredentials = (): boolean => !!(env.VONAGE_API_KEY && env.VONAGE_API_SECRET)

export function isWhatsAppConfigured(): boolean {
  return hasCredentials() && !!env.VONAGE_WHATSAPP_NUMBER
}

/**
 * SMS needs no number of its own.
 *
 * WhatsApp sends from a registered number; SMS sends from a sender id, which is a short
 * alphanumeric name rather than a line somebody owns. So SMS is available as soon as the
 * account is, and `VONAGE_SMS_FROM` only decides what the message appears to come from.
 */
export function isSmsConfigured(): boolean {
  return hasCredentials()
}

export function isChannelConfigured(channel: MessageChannel): boolean {
  return channel === 'sms' ? isSmsConfigured() : isWhatsAppConfigured()
}

/** Who the message appears to be from, which differs by channel. */
function senderFor(channel: MessageChannel): string {
  return channel === 'sms' ? env.VONAGE_SMS_FROM : toDigits(env.VONAGE_WHATSAPP_NUMBER ?? '')
}

/**
 * Where the message is posted, which also differs by channel.
 *
 * The Messages sandbox carries social channels only, so SMS has to go to the live API
 * while WhatsApp is still sandboxed — and the two have to work side by side, because
 * pointing both at one URL breaks whichever channel that URL is not for.
 */
function endpointFor(channel: MessageChannel): string {
  return channel === 'sms' ? env.VONAGE_MESSAGES_URL : env.VONAGE_WHATSAPP_URL
}

async function send(
  channel: MessageChannel,
  phone: string,
  message: Record<string, unknown>,
): Promise<WhatsAppResult> {
  if (!isChannelConfigured(channel)) {
    return { ok: false, error: `${channel === 'sms' ? 'SMS' : 'WhatsApp'} provider is not configured.` }
  }

  const auth = Buffer.from(`${env.VONAGE_API_KEY}:${env.VONAGE_API_SECRET}`).toString('base64')
  try {
    const res = await fetch(endpointFor(channel), {
      method: 'POST',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: senderFor(channel),
        to: toDigits(phone),
        channel,
        ...message,
      }),
    })
    const body = await res.text().catch(() => '')
    if (!res.ok) {
      logger.warn('Message send failed', { channel, endpoint: endpointFor(channel), status: res.status, to: maskPhone(phone), body: body.slice(0, 300) })
      return { ok: false, error: `Vonage responded ${res.status}: ${body.slice(0, 300)}` }
    }
    logger.info('Message sent', { channel, to: maskPhone(phone), kind: message.message_type })
    return { ok: true }
  } catch (err) {
    const error =
      err instanceof Error && err.name === 'TimeoutError'
        ? `The ${channel === 'sms' ? 'SMS' : 'WhatsApp'} provider did not answer within ${PROVIDER_TIMEOUT_MS / 1000}s.`
        : err instanceof Error
          ? err.message
          : String(err)
    logger.warn('Message send errored', { channel, to: maskPhone(phone), error })
    return { ok: false, error }
  }
}

export async function sendText(channel: MessageChannel, phone: string, text: string): Promise<WhatsAppResult> {
  return send(channel, phone, { message_type: 'text', text })
}

/**
 * A document, where the channel can carry one.
 *
 * SMS cannot attach a file, so it sends the caption and the link instead — a customer
 * still gets their invoice, they just tap through to it rather than receiving it inline.
 * Silently dropping the attachment, or refusing to send at all, would both be worse.
 */
export async function sendFile(
  channel: MessageChannel,
  phone: string,
  file: { url: string; caption?: string },
): Promise<WhatsAppResult> {
  if (channel === 'sms') {
    return sendText('sms', phone, [file.caption, file.url].filter(Boolean).join('\n'))
  }
  return send('whatsapp', phone, { message_type: 'file', file })
}

/**
 * Tries each channel in turn and reports the one that worked.
 *
 * Used where nobody chose a channel — an expiry reminder, an invoice going out on its own
 * — so a customer whose WhatsApp number is not their phone number still hears from us.
 */
export async function sendTextVia(
  channels: MessageChannel[],
  phone: string,
  text: string,
): Promise<WhatsAppResult & { channel?: MessageChannel }> {
  let last: WhatsAppResult = { ok: false, error: 'No channel is configured.' }
  for (const channel of channels) {
    if (!isChannelConfigured(channel)) continue
    const result = await sendText(channel, phone, text)
    if (result.ok) return { ...result, channel }
    last = result
  }
  return last
}

/** Unchanged from the original transport: a host Vonage could actually fetch from. */
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
