export interface EmailResult {
  ok: boolean
  via?: 'primary' | 'fallback'
  error?: string
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface WhatsAppResult {
  ok: boolean
  error?: string
}

export type OtpIntent = 'VERIFY_PHONE' | 'HANDOVER_BAG'
export type OtpChannel = 'WHATSAPP' | 'EMAIL'
export type OtpDelivery = 'WHATSAPP' | 'EMAIL' | 'MOCK' | 'FAILED'

export interface SendOtpOptions {
  channel?: OtpChannel
  allowMockFallback?: boolean
  purpose?: 'VERIFY' | 'RETRIEVAL'
  customerName?: string
}

export interface InvitationEmailOptions {
  fullName: string
  roleLabel: string
  tenantName: string
  link: string
  expiresInHours: number
  invitedByName?: string
}
