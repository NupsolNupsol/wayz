import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { invitationCopy, otpEmailCopy } from '../constants/messages.constants.js'
import type { EmailMessage, EmailResult, InvitationEmailOptions } from '../interfaces/index.js'

interface SmtpProfile {
  label: 'primary' | 'fallback'
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

function primaryProfile(): SmtpProfile | null {
  if (!env.MAIL_HOST || !env.SENDER_EMAIL || !env.SENDER_PASSWORD) return null
  return {
    label: 'primary',
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    user: env.SENDER_EMAIL,
    // App passwords are shown in groups of four; a pasted space is a silent auth failure.
    pass: env.SENDER_PASSWORD.replace(/\s+/g, ''),
    from: env.SENDER_EMAIL,
  }
}

function fallbackProfile(): SmtpProfile | null {
  if (!env.MAIL_FALLBACK_HOST || !env.MAIL_FALLBACK_USER || !env.MAIL_FALLBACK_PASSWORD) return null
  return {
    label: 'fallback',
    host: env.MAIL_FALLBACK_HOST,
    port: env.MAIL_FALLBACK_PORT,
    secure: env.MAIL_FALLBACK_SECURE,
    user: env.MAIL_FALLBACK_USER,
    pass: env.MAIL_FALLBACK_PASSWORD.replace(/\s+/g, ''),
    from: env.MAIL_FALLBACK_USER,
  }
}

function profiles(): SmtpProfile[] {
  return [primaryProfile(), fallbackProfile()].filter((p): p is SmtpProfile => p !== null)
}

export function isEmailConfigured(): boolean {
  return profiles().length > 0
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return '•••'
  const head = user.slice(0, Math.min(2, user.length))
  return `${head}${'•'.repeat(Math.max(3, user.length - head.length))}@${domain}`
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

const transporters = new Map<string, Transporter>()

function getTransporter(p: SmtpProfile): Transporter {
  const existing = transporters.get(p.label)
  if (existing) return existing
  const tx = nodemailer.createTransport({
    host: p.host,
    port: p.port,
    secure: p.secure,
    auth: { user: p.user, pass: p.pass },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  })
  transporters.set(p.label, tx)
  return tx
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const available = profiles()
  if (!available.length) return { ok: false, error: 'Email provider is not configured.' }
  if (!looksLikeEmail(message.to)) return { ok: false, error: 'That email address is not valid.' }

  const errors: string[] = []
  for (const profile of available) {
    try {
      await getTransporter(profile).sendMail({
        from: `"${env.MAIL_FROM_NAME}" <${profile.from}>`,
        to: message.to.trim(),
        subject: message.subject,
        text: message.text,
        html: message.html ?? undefined,
      })
      logger.info('Email sent', { to: maskEmail(message.to), via: profile.label, host: profile.host })
      return { ok: true, via: profile.label }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.warn('Email send failed', { to: maskEmail(message.to), via: profile.label, host: profile.host, error })
      errors.push(`${profile.label}: ${error}`)
    }
  }
  return { ok: false, error: errors.join(' | ') }
}

const NEWLINE = String.fromCharCode(10)

export function invitationEmail(options: InvitationEmailOptions): Pick<EmailMessage, 'subject' | 'text' | 'html'> {
  const { fullName, roleLabel, tenantName, link, expiresInHours, invitedByName } = options
  const copy = invitationCopy(tenantName)
  const subject = copy.subject
  const invitedBy = invitedByName ?? tenantName

  const text = [
    copy.greeting(fullName),
    '',
    copy.opened(invitedBy, roleLabel),
    '',
    copy.choose,
    '',
    `    ${link}`,
    '',
    copy.expires(expiresInHours),
    copy.privacy,
    '',
    copy.ignore,
    '',
    `— ${tenantName}`,
  ].join(NEWLINE)

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<body style="margin:0;padding:0;background:#f1f5f9;" dir="rtl">
  <!-- Preheader: the grey preview line in an inbox list. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${copy.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,33,74,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <!-- Brand bar -->
          <tr>
            <td style="background:#0f214a;padding:24px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:.5px;">${tenantName}</span>
              <div style="height:3px;width:44px;background:#14b8a6;margin-top:10px;border-radius:2px;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 0;text-align:right;">
              <p style="margin:0 0 6px;font-size:15px;color:#0f214a;">${copy.greeting(fullName)}</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#64748b;">
                ${invitedBy} أنشأ لك حسابًا بصفة <strong style="color:#0f214a;">${roleLabel}</strong>.
                ${copy.choose}
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 32px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#14b8a6;border-radius:12px;">
                    <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                      ${copy.button}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 32px 0;text-align:right;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">&#9201; ${copy.expires(expiresInHours)}</p>
              <p style="margin:0;font-size:13px;color:#64748b;">&#128274; ${copy.privacy}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;text-align:right;">
                    <div style="font-size:11px;letter-spacing:.4px;color:#0f766e;font-weight:700;margin-bottom:6px;">إذا لم يعمل الزر</div>
                    <span dir="ltr" style="display:inline-block;word-break:break-all;font-size:12px;color:#0f214a;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${link}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 32px;text-align:right;">
              <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;">
                  ${copy.ignore}
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">هذه رسالة آلية من ${tenantName}. الرجاء عدم الرد عليها.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

export function otpEmail(
  code: string,
  options: { brand?: string; purpose?: 'VERIFY' | 'RETRIEVAL'; customerName?: string } = {},
): Pick<EmailMessage, 'subject' | 'text' | 'html'> {
  const brand = options.brand ?? env.MAIL_FROM_NAME
  const copy = otpEmailCopy(code, brand, {
    retrieval: options.purpose === 'RETRIEVAL',
    customerName: options.customerName,
  })
  const greeting = copy.greeting
  const reason = copy.reason

  const subject = copy.subject

  const text = [
    `${greeting}`,
    '',
    `استخدم هذا الرمز ${reason}:`,
    '',
    `    ${code}`,
    '',
    copy.expiry,
    copy.warning,
    '',
    copy.ignore,
    '',
    `— ${brand}`,
  ].join(NEWLINE)

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<body style="margin:0;padding:0;background:#f1f5f9;" dir="rtl">
  <!-- Preheader: the grey preview line in an inbox list. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${copy.preheader(brand)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,33,74,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <!-- Brand bar -->
          <tr>
            <td style="background:#0f214a;padding:24px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:.5px;">${brand}</span>
              <div style="height:3px;width:44px;background:#14b8a6;margin-top:10px;border-radius:2px;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;text-align:right;">
              <p style="margin:0 0 6px;font-size:15px;color:#0f214a;">${greeting}</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#64748b;">
                استخدم الرمز أدناه ${reason}.
              </p>
            </td>
          </tr>

          <!-- The code -->
          <tr>
            <td align="center" style="padding:0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;">
                <tr>
                  <td align="center" style="padding:22px 16px;">
                    <div style="font-size:11px;letter-spacing:.4px;color:#0f766e;font-weight:700;margin-bottom:8px;">${copy.codeLabel}</div>
                    <div dir="ltr" style="font-size:40px;line-height:1;font-weight:700;letter-spacing:12px;color:#0f214a;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding-left:12px;">${code}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;text-align:right;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">⏱ ${copy.expiry}</p>
              <p style="margin:0;font-size:13px;color:#64748b;">🔒 اقرأه لموظف ${brand} فقط. لن نطلبه منك عبر الهاتف أو الرسائل أبدًا.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 32px;text-align:right;">
              <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;">
                  ${copy.ignore}
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">هذه رسالة آلية من ${brand}. الرجاء عدم الرد عليها.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
