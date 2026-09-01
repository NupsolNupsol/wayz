import { http, unwrap } from './client'
import type { OtpChannel, OtpDelivery } from './types'

export type OtpIntent = 'VERIFY_PHONE' | 'HANDOVER_BAG'

export const otpApi = {
  send: (destination: string, intent: OtpIntent, channel: OtpChannel = 'WHATSAPP') =>
    unwrap<{ delivered: OtpDelivery; channel: OtpChannel; code?: string; error?: string }>(
      http.post('/otp/send', { phone: destination, intent, channel }),
    ),
  verify: (destination: string, intent: OtpIntent, code: string) =>
    unwrap<{ verified: boolean }>(http.post('/otp/verify', { phone: destination, intent, code })),
}
