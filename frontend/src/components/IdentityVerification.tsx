import { useRef, useState } from 'react'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/utils'
import { ShieldCheck, Send, MessageSquareWarning, IdCard, UserCog, Camera, X, TriangleAlert, MessageCircle, Mail } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from './Modal'
import { Select } from './Select'
import { Button, Field, Badge } from './ui'
import { useConfirmVerification, useSendVerification } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import type { ConfirmVerificationInput, VerificationChallenge, VerificationDocumentInput } from '@/api/booking.api'
import type { IdDocumentType, IdentityVerification, OtpChannel, VerificationPurpose } from '@/api/types'

type Tab = 'WHATSAPP' | 'EMAIL' | 'DOCUMENT' | 'OVERRIDE'

const CODED: Record<'WHATSAPP' | 'EMAIL', { channel: OtpChannel; method: 'WHATSAPP_OTP' | 'EMAIL_OTP'; labelKey: string; nounKey: string }> = {
  WHATSAPP: { channel: 'WHATSAPP', method: 'WHATSAPP_OTP', labelKey: 'ui:identity.whatsappTab', nounKey: 'ui:identity.phoneNoun' },
  EMAIL: { channel: 'EMAIL', method: 'EMAIL_OTP', labelKey: 'ui:identity.emailTab', nounKey: 'ui:identity.emailNoun' },
}

const DOC_TYPES: { labelKey: string; value: IdDocumentType }[] = [
  { labelKey: 'common:label.nationalid', value: 'NATIONAL_ID' },
  { labelKey: 'common:label.iqamaresidencepermit', value: 'IQAMA' },
  { labelKey: 'common:label.passport', value: 'PASSPORT' },
  { labelKey: 'common:label.drivinglicence', value: 'DRIVING_LICENCE' },
]

const MAX_EDGE = 1280

function toDownscaledDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a readable image.'))
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas is unavailable.'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export function IdentityVerificationModal({
  open,
  onClose,
  bookingId,
  customerName,
  customerEmail,
  purpose = 'RETRIEVAL',
  onVerified,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  customerName: string
  customerEmail?: string
  purpose?: VerificationPurpose
  onVerified: () => void
}) {
  const { t } = useTranslation(['ui', 'common'])
  const sendMut = useSendVerification()
  const confirmMut = useConfirmVerification()

  const [tab, setTab] = useState<Tab>('WHATSAPP')
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null)
  const [code, setCode] = useState('')

  const [docType, setDocType] = useState<IdDocumentType>('NATIONAL_ID')
  const [docNumber, setDocNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [image, setImage] = useState<string>('')
  const [reason, setReason] = useState('')

  const [authoriserEmail, setAuthoriserEmail] = useState('')
  const [authoriserPassword, setAuthoriserPassword] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  const coded = tab === 'WHATSAPP' || tab === 'EMAIL' ? CODED[tab] : null

  const reset = () => {
    setTab('WHATSAPP'); setChallenge(null); setCode('')
    setDocType('NATIONAL_ID'); setDocNumber(''); setHolderName(''); setImage(''); setReason('')
    setAuthoriserEmail(''); setAuthoriserPassword('')
  }

  const close = () => { reset(); onClose() }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    setTab(next)
    setChallenge(null)
    setCode('')
  }

  const sendCode = async () => {
    if (!coded) return
    try {
      const res = await sendMut.mutateAsync({ id: bookingId, channel: coded.channel, purpose })
      setChallenge(res)
      if (res.delivered === 'FAILED') {
        toast('warning', `${t(coded.labelKey)} could not be delivered`, t('identity.tryOther'))
      } else {
        toast('success', `Code sent — ${t(coded.labelKey)}`, `Sent to ${res.destinationMasked} — ask the customer to read it back.`)
      }
    } catch (e) {
      toast('danger', t('identity.couldNotSend'), e instanceof ApiError ? e.message : '')
    }
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    try {
      setImage(await toDownscaledDataUri(file))
    } catch (e) {
      toast('danger', t('identity.couldNotRead'), e instanceof Error ? e.message : '')
    }
  }

  const document = (): VerificationDocumentInput => ({
    documentType: docType,
    documentNumber: docNumber.trim(),
    holderName: holderName.trim(),
    image: image || undefined,
  })

  const submit = async () => {
    const input: ConfirmVerificationInput = coded
      ? { method: coded.method, code }
      : tab === 'DOCUMENT'
        ? { method: 'ID_DOCUMENT', reason: reason.trim(), document: document() }
        : {
            method: 'MANAGER_OVERRIDE',
            reason: reason.trim(),
            authoriserEmail: authoriserEmail.trim(),
            authoriserPassword,
            document: docNumber.trim() && holderName.trim() ? document() : undefined,
          }
    try {
      await confirmMut.mutateAsync({ id: bookingId, input, purpose })
      toast('success', t('identity.verified'), coded ? `${t(coded.labelKey)} confirmed.` : 'Fallback recorded in the audit trail.')
      reset()
      onVerified()
    } catch (e) {
      toast('danger', t('identity.notVerified'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    }
  }

  const nameMismatch =
    !coded && holderName.trim().length > 1 && holderName.trim().toLowerCase() !== customerName.trim().toLowerCase()

  const canSubmit = coded
    ? code.length === 4 && !!challenge && challenge.delivered !== 'FAILED'
    : tab === 'DOCUMENT'
      ? !!docNumber.trim() && !!holderName.trim() && reason.trim().length >= 3
      : !!authoriserEmail.trim() && !!authoriserPassword && reason.trim().length >= 3

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('identity.title')}
      subtitle={`Prove ${customerName || 'the claimant'} owns these bags before opening the compartment`}
      size="lg"
      testId="verify-modal"
      footer={
        <>
          <Button variant="ghost" onClick={close}>{t('common:action.cancel')}</Button>
          <Button onClick={submit} loading={confirmMut.isPending} disabled={!canSubmit} data-testid="verify-submit">
            <ShieldCheck size={15} /> {t('identity.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        <TabButton active={tab === 'WHATSAPP'} onClick={() => switchTab('WHATSAPP')} testId="verify-tab-otp" icon={<MessageCircle size={14} />}>
          WhatsApp code
        </TabButton>
        <TabButton active={tab === 'EMAIL'} onClick={() => switchTab('EMAIL')} testId="verify-tab-email" icon={<Mail size={14} />}>
          Email code
        </TabButton>
        <TabButton active={tab === 'DOCUMENT'} onClick={() => switchTab('DOCUMENT')} testId="verify-tab-document" icon={<IdCard size={14} />}>
          ID document
        </TabButton>
        <TabButton active={tab === 'OVERRIDE'} onClick={() => switchTab('OVERRIDE')} testId="verify-tab-override" icon={<UserCog size={14} />}>
          Manager override
        </TabButton>
      </div>

      {coded && (
        <div data-testid="verify-otp-panel">
          <p className="text-sm text-muted mb-3">
            The code goes to the {t(coded.nounKey)} recorded on this booking — it cannot be redirected to another
            {coded.channel === 'EMAIL' ? ' inbox' : ' handset'}.
          </p>
          {coded.channel === 'EMAIL' && !customerEmail ? (
            <div className="lf-card p-3 border-amber-300 bg-amber-50 dark:bg-amber-900/20" data-testid="verify-no-email">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <Mail size={16} /> {t('identity.noEmail')}
              </p>
              <p className="text-xs text-muted mt-1">
                No address was recorded for this customer when the booking was created, so a code cannot be
                emailed. Use WhatsApp, or verify with an ID document. Capture an email next time on the customer
                form to enable this channel.
              </p>
            </div>
          ) : !challenge ? (
            <Button variant="secondary" onClick={sendCode} loading={sendMut.isPending} data-testid="verify-send">
              <Send size={15} /> Send {t(coded.labelKey).toLowerCase()} to the customer
            </Button>
          ) : challenge.delivered === 'FAILED' ? (
            <div className="lf-card p-3 border-amber-300 bg-amber-50 dark:bg-amber-900/20" data-testid="verify-delivery-failed">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <MessageSquareWarning size={16} /> {t(coded.labelKey)} could not be delivered
              </p>
              <p className="text-xs text-muted mt-1">{challenge.error ?? 'The provider is unavailable.'}</p>
              <p className="text-xs text-muted mt-2">
                The code was <strong>not</strong> shown to you on purpose — typing a code you were just shown proves
                nothing. Verify with the <strong>ID document</strong> tab, or ask a manager to override.
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="secondary" onClick={() => setTab('DOCUMENT')} data-testid="verify-goto-document">
                  <IdCard size={15} /> {t('identity.useDocument')}
                </Button>
                <Button variant="ghost" onClick={sendCode} loading={sendMut.isPending}>{t('identity.retrySend')}</Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-success mb-2" data-testid="verify-sent">
                Code sent to {challenge.phoneMasked} — ask the customer to read it back.
              </p>
              <div className="flex items-center gap-2">
                <input
                  data-testid="verify-code"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('identity.code')}
                  className="lf-input tracking-[0.4em] text-center font-mono w-40"
                />
                <button type="button" className="text-xs text-brand" onClick={sendCode}>{t('identity.resend')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {(tab === 'DOCUMENT' || tab === 'OVERRIDE') && (
        <div data-testid={tab === 'DOCUMENT' ? 'verify-document-panel' : 'verify-override-panel'}>
          <div className="lf-card p-3 mb-4 bg-canvas dark:bg-dk-elevated">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <TriangleAlert size={15} className="text-amber-500" />
              {tab === 'DOCUMENT' ? t('identity.fallbackNote') : t('identity.overrideNote')}
            </p>
            <p className="text-xs text-muted mt-1">
              {tab === 'DOCUMENT'
                ? 'Use only when the WhatsApp code cannot reach the customer. Check the photo against the person in front of you.'
                : 'The manager authorises with their own credentials on this device. Your session is unchanged; the override is logged under their name.'}
            </p>
          </div>

          {tab === 'OVERRIDE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field label={t('identity.authoriserEmail')} required>
                <input
                  className="lf-input"
                  type="email"
                  autoComplete="off"
                  value={authoriserEmail}
                  onChange={(e) => setAuthoriserEmail(e.target.value)}
                  placeholder={t('identity.managerPlaceholder')}
                  data-testid="verify-sup-email"
                />
              </Field>
              <Field label={t('identity.authoriserPassword')} required>
                <input
                  className="lf-input"
                  type="password"
                  autoComplete="new-password"
                  value={authoriserPassword}
                  onChange={(e) => setAuthoriserPassword(e.target.value)}
                  data-testid="verify-sup-password"
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label={t('identity.docType')} required={tab === 'DOCUMENT'}>
              <Select value={docType} onChange={(v) => setDocType(v as IdDocumentType)} options={DOC_TYPES.map((d) => ({ label: t(d.labelKey), value: d.value }))} testId="verify-doc-type" />
            </Field>
            <Field label={t('identity.docNumber')} required={tab === 'DOCUMENT'} hint={t('identity.lastFour')}>
              <input className="lf-input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} data-testid="verify-doc-number" />
            </Field>
          </div>

          <Field label={t('identity.docName')} required={tab === 'DOCUMENT'} error={nameMismatch ? `Does not match the booking (${customerName}) — explain below or escalate.` : undefined}>
            <input className="lf-input" value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder={customerName} data-testid="verify-doc-holder" />
          </Field>

          <Field label={t('identity.docPhoto')} hint={t('identity.photoNote')}>
            {image ? (
              <div className="lf-card p-2 flex items-center gap-3" data-testid="verify-doc-preview">
                <img src={image} alt="Captured identity document" className="h-20 w-auto rounded-lg object-cover" />
                <button type="button" onClick={() => setImage('')} className="lf-btn-ghost !h-8 !px-2 text-xs" data-testid="verify-doc-clear">
                  <X size={14} /> Remove
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void pickImage(e.target.files?.[0])}
                  data-testid="verify-doc-file"
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()} data-testid="verify-doc-capture">
                  <Camera size={15} /> {t('identity.capture')}
                </Button>
              </>
            )}
          </Field>

          <Field label={tab === 'DOCUMENT' ? 'Why was the WhatsApp code not used?' : 'Reason for the override'} required>
            <textarea
              className="lf-input h-20 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tab === 'DOCUMENT' ? 'e.g. Customer lost their phone; ID checked against the booking name' : 'e.g. No phone and no ID; recognised by the desk manager'}
              data-testid="verify-reason"
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

function TabButton({ active, onClick, children, icon, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode; testId: string }) {
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

export function VerificationTrail({ verifications }: { verifications: IdentityVerification[] }) {
  const { t } = useTranslation(['ui', 'status', 'common'])
  const statusLabel = useStatusLabel()
  if (!verifications.length) return <p className="text-sm text-muted">{t('identity.noneRecorded')}</p>
  return (
    <ul className="flex flex-col gap-3" data-testid="verification-trail">
      {verifications.map((v, i) => (
        <li key={i} className="lf-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm flex items-center gap-2">
              <ShieldCheck size={15} className={v.method === 'WHATSAPP_OTP' ? 'text-success' : 'text-amber-500'} />
              {t(`identity.method.${v.method}`, { defaultValue: v.method.replaceAll('_', ' ') })}
            </span>
            <Badge tone={v.status === 'CONSUMED' ? 'neutral' : 'success'}>{statusLabel(v.status, 'verification')}</Badge>
          </div>
          <p className="text-xs text-muted mt-1">
            {t('identity.trailLine', {
              purpose: t(`status:purpose.${v.purpose}`, { defaultValue: v.purpose }),
              at: formatDateTime(new Date(v.verifiedAt).getTime()),
              role: t(`common:role.${v.verifiedByRole}`, { defaultValue: v.verifiedByRole }),
            })}
          </p>
          {v.document && (
            <p className="text-xs text-muted mt-1">
              {t(`common:label.${v.document.type.toLowerCase().replaceAll('_', '')}`, {
                defaultValue: v.document.type.replaceAll('_', ' '),
              })} ••{v.document.last4} — {v.document.holderName}
            </p>
          )}
          {v.reason && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{t('identity.reason', { reason: v.reason })}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
