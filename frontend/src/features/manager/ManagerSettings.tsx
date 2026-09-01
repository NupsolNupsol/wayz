import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Save, Building, Clock, CreditCard, ShieldCheck, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { PhoneInput } from '@/components/PhoneInput'
import { Card, SectionTitle, Button, Field, Spinner, Badge } from '@/components/ui'
import { useManagerSettings, useUpdateSettings } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'

const PAYMENT_METHODS = ['CASH', 'CARD', 'APPLE_PAY', 'TRANSFER']
const VERIFICATION_CHANNELS = [
  { id: 'WHATSAPP', labelKey: 'common:label.whatsappcode' },
  { id: 'EMAIL', labelKey: 'common:label.emailcode' },
]

export function ManagerSettings() {
  const { t } = useTranslation(['manager', 'common'])
  const { data, isLoading } = useManagerSettings()
  const update = useUpdateSettings()

  const [company, setCompany] = useState<Record<string, string>>({})
  const [identity, setIdentity] = useState<Record<string, string>>({})
  const [ops, setOps] = useState<Record<string, string>>({})
  const [methods, setMethods] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])

  useEffect(() => {
    if (!data) return
    setIdentity({
      name: data.name,
      legalName: data.legalName,
      crNumber: data.crNumber ?? '',
      vatNumber: data.vatNumber ?? '',
      currency: data.currency,
      vatRatePct: String(Math.round((data.vatRate ?? 0) * 100)),
    })
    setCompany({
      address: data.company?.address ?? '',
      city: data.company?.city ?? '',
      country: data.company?.country ?? '',
      phone: data.company?.phone ?? '',
      email: data.company?.email ?? '',
      website: data.company?.website ?? '',
    })
    setOps({
      timezone: data.settings?.timezone ?? 'Asia/Riyadh',
      gracePeriodMin: String(data.settings?.gracePeriodMin ?? 5),
      overtimeBlockMinutes: String(data.settings?.overtimeBlockMinutes ?? 60),
      expiryWarningMinutes: String(data.settings?.expiryWarningMinutes ?? 15),
    })
    setMethods(data.settings?.paymentMethods ?? ['CASH', 'CARD'])
    setChannels(data.settings?.verificationChannels ?? ['WHATSAPP', 'EMAIL'])
  }, [data])

  const save = () => {
    update.mutate(
      {
        name: identity.name,
        legalName: identity.legalName,
        crNumber: identity.crNumber,
        vatNumber: identity.vatNumber,
        currency: identity.currency,
        vatRate: Number(identity.vatRatePct || 0) / 100,
        company,
        settings: {
          timezone: ops.timezone,
          gracePeriodMin: Number(ops.gracePeriodMin || 0),
          overtimeBlockMinutes: Number(ops.overtimeBlockMinutes || 60),
          expiryWarningMinutes: Number(ops.expiryWarningMinutes || 15),
          paymentMethods: methods,
          verificationChannels: channels,
        },
      },
      {
        onSuccess: () => toast('success', t('settings.saved'), t('settings.savedDetail')),
        onError: (e) => toast('danger', t('common:error.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  if (isLoading || !data) {
    return (
      <div data-testid="manager-settings">
        <PageHeader title={t('settings.title')} subtitle={t('settings.loading')} />
        <Spinner />
      </div>
    )
  }

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <div data-testid="manager-settings">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.settings') }]}
        actions={<Button onClick={save} loading={update.isPending} data-testid="settings-save"><Save size={16} /> {t('common:action.saveChanges')}</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionTitle className="mb-3 flex items-center gap-2"><Building size={18} />{t('settings.company')}</SectionTitle>
          <Field label={t('settings.tradingName')} required><input className="lf-input" value={identity.name ?? ''} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} data-testid="settings-name" /></Field>
          <Field label={t('settings.legalName')}><input className="lf-input" value={identity.legalName ?? ''} onChange={(e) => setIdentity({ ...identity, legalName: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label={t('settings.crNumber')}><input className="lf-input" value={identity.crNumber ?? ''} onChange={(e) => setIdentity({ ...identity, crNumber: e.target.value })} /></Field>
            <Field label={t('settings.vatNumber')}><input className="lf-input" value={identity.vatNumber ?? ''} onChange={(e) => setIdentity({ ...identity, vatNumber: e.target.value })} /></Field>
          </div>
          <Field label={t('common:label.address')}><input className="lf-input" value={company.address ?? ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label={t('common:label.city')}><input className="lf-input" value={company.city ?? ''} onChange={(e) => setCompany({ ...company, city: e.target.value })} /></Field>
            <Field label={t('common:label.country')}><input className="lf-input" value={company.country ?? ''} onChange={(e) => setCompany({ ...company, country: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label={t('common:field.phone')}>
              <PhoneInput value={company.phone ?? ''} onChange={(v) => setCompany({ ...company, phone: v })} testId="settings-phone" />
            </Field>
            <Field label={t('common:field.email')}><input className="lf-input" value={company.email ?? ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></Field>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><Clock size={18} />{t('settings.timeOvertime')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label={t('settings.gracePeriod')} required hint={t('settings.graceHint')}>
                <input type="number" min={0} max={120} className="lf-input" value={ops.gracePeriodMin ?? '5'} onChange={(e) => setOps({ ...ops, gracePeriodMin: e.target.value })} data-testid="settings-grace" />
              </Field>
              <Field label={t('settings.overtimeBlock')} hint={t('settings.overtimeHint')}>
                <input type="number" min={15} max={240} className="lf-input" value={ops.overtimeBlockMinutes ?? '60'} onChange={(e) => setOps({ ...ops, overtimeBlockMinutes: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label={t('settings.warnBefore')} hint={t('settings.warnHint')}>
                <input type="number" min={1} max={120} className="lf-input" value={ops.expiryWarningMinutes ?? '15'} onChange={(e) => setOps({ ...ops, expiryWarningMinutes: e.target.value })} />
              </Field>
              <Field label={t('settings.timezone')}><input className="lf-input" value={ops.timezone ?? ''} onChange={(e) => setOps({ ...ops, timezone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label={t('settings.currency')}><input className="lf-input" value={identity.currency ?? ''} onChange={(e) => setIdentity({ ...identity, currency: e.target.value })} /></Field>
              <Field label={t('settings.vatRate')} hint={t('settings.vatHint')}>
                <input type="number" min={0} max={100} className="lf-input" value={identity.vatRatePct ?? '15'} onChange={(e) => setIdentity({ ...identity, vatRatePct: e.target.value })} data-testid="settings-vat" />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><CreditCard size={18} />{t('settings.paymentMethods')}</SectionTitle>
            <p className="text-xs text-muted mb-2">{t('settings.paymentHint')}</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggle(methods, setMethods, m)}
                  data-testid={`settings-method-${m}`}
                  className={clsx('lf-chip !px-3 !py-1.5 border transition-colors', methods.includes(m) ? 'border-brand bg-brand/10 text-brand font-semibold' : 'border-line text-muted')}
                >
                  {t(`status:method.${m}`, { defaultValue: m.replaceAll('_', ' ') })}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><ShieldCheck size={18} />{t('settings.verificationChannels')}</SectionTitle>
            <div className="flex flex-wrap gap-2 mb-3">
              {VERIFICATION_CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(channels, setChannels, c.id)}
                  data-testid={`settings-channel-${c.id}`}
                  className={clsx('lf-chip !px-3 !py-1.5 border transition-colors', channels.includes(c.id) ? 'border-brand bg-brand/10 text-brand font-semibold' : 'border-line text-muted')}
                >
                  {t(c.labelKey)}
                </button>
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-canvas dark:bg-dk-elevated p-3">
              <Info size={15} className="text-muted shrink-0 mt-0.5" />
              <p className="text-xs text-muted">
                <Trans
                  i18nKey="manager:settings.secretsNote"
                  components={{ 1: <strong className="text-navy dark:text-dk-text" /> }}
                />
                <span className="block mt-1">{t('settings.fallbacksNote')}<Badge tone="neutral">{t('settings.idDocument')}</Badge>{' '}
                  <Badge tone="neutral">{t('settings.supervisorOverride')}</Badge>
                </span>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
