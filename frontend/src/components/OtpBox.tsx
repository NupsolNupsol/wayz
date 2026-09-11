import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Send, Copy, MessageCircle, MessageSquare, Mail } from 'lucide-react'
import { clsx } from 'clsx'
import { otpApi, type OtpIntent } from '@/api/otp.api'
import { Button } from './ui'
import { toast } from '@/state/toastStore'
import { useAuthStore } from '@/store/auth'
import type { OtpChannel } from '@/api/types'

export function OtpBox({
  phone,
  email,
  intent = 'VERIFY_PHONE',
  verified,
  onVerified,
  disabled,
}: {
  phone: string
  email?: string
  intent?: OtpIntent
  verified: boolean
  onVerified: (ok: boolean) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('ui')
  const [channel, setChannel] = useState<OtpChannel>('WHATSAPP')
  const [sent, setSent] = useState(false)
  const [demoCode, setDemoCode] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null)
  const ttlMin = useAuthStore((s) => s.me?.tenant?.phoneProofTtlMin ?? 30)

  // WhatsApp and SMS both go to the phone; only email goes anywhere else.
  const destination = channel === 'EMAIL' ? (email ?? '') : phone
  const canSend = !!destination

  const switchChannel = (next: OtpChannel) => {
    if (next === channel) return
    setChannel(next)
    setSent(false)
    setDemoCode('')
    setCode('')
  }

  const doSend = async () => {
    setBusy(true)
    try {
      const { code: c, error } = await otpApi.send(destination, intent, channel)
      setDemoCode(c ?? '')
      setSent(true)
      const via = channel === 'EMAIL' ? 'email' : 'WhatsApp'
      if (c && error) toast('warning', `${via} delivery failed — using fallback code`, error.slice(0, 120))
      else if (c) toast('info', t('otp.sent'), `Code ${c} — copy it into the field`)
      else toast('success', `OTP sent via ${via}`, `The customer receives the code at ${destination}`)
    } finally {
      setBusy(false)
    }
  }

  const doVerify = async () => {
    setBusy(true)
    try {
      const { verified: ok } = await otpApi.verify(destination, intent, code)
      onVerified(ok)
      if (ok) setVerifiedAt(Date.now())
      toast(ok ? 'success' : 'danger', ok ? 'Identity verified' : 'Incorrect code')
    } finally {
      setBusy(false)
    }
  }

  /**
   * The server only honours a confirmation for so long. Letting the tick box stay green past that
   * means the agent presses Confirm payment and is refused with the customer standing there — so
   * the box goes back to asking, a minute before the proof actually lapses.
   */
  useEffect(() => {
    if (!verified || !verifiedAt) return
    const lapsesIn = Math.max(0, (ttlMin - 1) * 60_000 - (Date.now() - verifiedAt))
    const id = window.setTimeout(() => {
      onVerified(false)
      setSent(false)
      setCode('')
      setVerifiedAt(null)
      toast('warning', t('otp.lapsed'), t('otp.lapsedDetail'))
    }, lapsesIn)
    return () => window.clearTimeout(id)
  }, [verified, verifiedAt, ttlMin, onVerified, t])

  if (verified) {
    return (
      <div className="lf-card p-3 flex items-center gap-2 text-success" data-testid="otp-verified">
        <ShieldCheck size={18} /> <span className="text-sm font-semibold">{t('otp.verified')}</span>
      </div>
    )
  }

  return (
    <div className="lf-card p-4" data-testid="otp-box" data-phone={phone ?? undefined}>
      {/*
        Always offered, not only when there is an email on file.

        A customer's WhatsApp number is frequently not the number they answer — the desk
        needs to be able to say "it did not arrive, send it as a text" without leaving the
        screen or editing the customer.
      */}
      <div className="flex gap-2 mb-3" role="tablist" aria-label={t('otp.channel')}>
        <ChannelTab active={channel === 'WHATSAPP'} onClick={() => switchChannel('WHATSAPP')} icon={<MessageCircle size={14} />} testId="otp-channel-whatsapp">{t('otp.whatsapp')}</ChannelTab>
        <ChannelTab active={channel === 'SMS'} onClick={() => switchChannel('SMS')} icon={<MessageSquare size={14} />} testId="otp-channel-sms">{t('otp.sms')}</ChannelTab>
        {email && (
          <ChannelTab active={channel === 'EMAIL'} onClick={() => switchChannel('EMAIL')} icon={<Mail size={14} />} testId="otp-channel-email">{t('otp.email')}</ChannelTab>
        )}
      </div>

      {!sent ? (
        <>
          <Button onClick={doSend} loading={busy} disabled={disabled || !canSend} data-testid="otp-send">
            <Send size={15} /> Send code to {destination || 'customer'}
          </Button>
          <p className="mt-2 text-xs text-muted">{t('otp.mustVerify')}</p>
          {!canSend && (
            <p className="mt-2 text-xs text-amber-600">
              No {channel === 'EMAIL' ? 'email address' : 'phone number'} on file for this customer.
            </p>
          )}
        </>
      ) : (
        <div>
          {demoCode ? (
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(demoCode); setCode(demoCode) }}
              className="mb-2 inline-flex items-center gap-2 rounded-lg bg-switchc/10 text-navy px-3 py-1.5 text-sm"
              data-testid="otp-demo-code"
              title={t('otp.mock')}
            >
              <Copy size={14} /> Mock OTP: <strong className="font-mono tracking-widest">{demoCode}</strong>
            </button>
          ) : (
            <p className="mb-2 text-xs text-success" data-testid="otp-whatsapp-sent">
              Code sent to {destination} — ask the customer to read it back.
            </p>
          )}
          <div className="flex items-center gap-2">
            {/*
              Four digits is what the platform sends, not what the box may hold.

              A deployment can also carry a standing code for a test team, and that is set by
              whoever runs the server — it may be six digits, or eight. Pinning the field to four
              made such a code impossible to type: the agent got as far as the fourth character
              and the box stopped accepting input, so a correct code was rejected as a wrong one.
            */}
            <input
              data-testid="otp-input"
              inputMode="numeric"
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder={t('otp.code')}
              className="lf-input tracking-[0.4em] text-center font-mono w-40"
            />
            <Button onClick={doVerify} loading={busy} disabled={code.length < 4} data-testid="otp-verify">{t('otp.verify')}</Button>
            <button className="text-xs text-brand" onClick={doSend} type="button">{t('otp.resend')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelTab({ active, onClick, children, icon, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={clsx(
        'lf-chip !px-3 !py-1.5 border transition-colors',
        active ? 'border-brand bg-brand/10 text-brand font-semibold' : 'border-line text-muted hover:border-brand',
      )}
    >
      {icon} {children}
    </button>
  )
}
