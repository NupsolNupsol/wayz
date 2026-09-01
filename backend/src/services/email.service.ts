import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
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
    pass: env.SENDER_PASSWORD,
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
  const subject = `Set up your ${tenantName} account`
  const invitedBy = invitedByName ? `${invitedByName} has` : `${tenantName} has`

  const text = [
    `Hello ${fullName},`,
    '',
    `${invitedBy} created a ${tenantName} account for you as ${roleLabel}.`,
    '',
    'Choose your own password to finish setting it up:',
    '',
    `    ${link}`,
    '',
    `The link works once and expires in ${expiresInHours} hours.`,
    'Nobody at the company knows your password, and nobody can see it.',
    '',
    'If you were not expecting this, ignore the email — the account cannot be used until a password is set.',
    '',
    `— ${tenantName}`,
  ].join(NEWLINE)

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;">
  <!-- Preheader: the grey preview line in an inbox list. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Choose your password to finish setting up your ${tenantName} account.</div>
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
            <td style="padding:32px 32px 0;">
              <p style="margin:0 0 6px;font-size:15px;color:#0f214a;">Hello ${fullName},</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">
                ${invitedBy} created an account for you as <strong style="color:#0f214a;">${roleLabel}</strong>.
                Choose your own password to finish setting it up.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 32px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#14b8a6;border-radius:12px;">
                    <a href="${link}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                      Choose my password
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 32px 0;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">&#9201; The link works once and expires in <strong style="color:#0f214a;">${expiresInHours} hours</strong>.</p>
              <p style="margin:0;font-size:13px;color:#64748b;">&#128274; Nobody at the company knows your password, and nobody can see it.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#0f766e;font-weight:700;margin-bottom:6px;">If the button does not work</div>
                    <span style="word-break:break-all;font-size:12px;color:#0f214a;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${link}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 32px;">
              <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  If you were not expecting this, ignore the email — the account cannot be used until a password is set.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated message from ${tenantName}. Please do not reply.</p>
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
  const retrieval = options.purpose === 'RETRIEVAL'
  const greeting = options.customerName ? `Hello ${options.customerName},` : 'Hello,'
  const reason = retrieval
    ? 'to collect your items from our counter'
    : 'to confirm your identity for your booking'

  const subject = `${code} is your ${brand} verification code`

  const text = [
    `${greeting}`,
    '',
    `Use this code ${reason}:`,
    '',
    `    ${code}`,
    '',
    'It expires in 5 minutes and can be used once.',
    'Please read it out to the agent — never share it with anyone else.',
    '',
    `If you did not request this, ignore this email and no action will be taken.`,
    '',
    `— ${brand}`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;">
  <!-- Preheader: the grey preview line in an inbox list. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${brand} code is ${code}. It expires in 5 minutes.</div>
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
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 6px;font-size:15px;color:#0f214a;">${greeting}</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">
                Use the code below ${reason}.
              </p>
            </td>
          </tr>

          <!-- The code -->
          <tr>
            <td align="center" style="padding:0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;">
                <tr>
                  <td align="center" style="padding:22px 16px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:#0f766e;font-weight:700;margin-bottom:8px;">Verification code</div>
                    <div style="font-size:40px;line-height:1;font-weight:700;letter-spacing:12px;color:#0f214a;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding-left:12px;">${code}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">⏱ Expires in <strong style="color:#0f214a;">5 minutes</strong> and can be used once.</p>
              <p style="margin:0;font-size:13px;color:#64748b;">🔒 Read it out to the ${brand} agent only. We will never ask for it by phone or message.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 32px;">
              <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  If you did not request this code, you can safely ignore this email — no action will be taken on your booking.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated message from ${brand}. Please do not reply.</p>
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
