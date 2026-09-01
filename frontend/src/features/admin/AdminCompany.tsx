import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Palette, Save, ToggleRight } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { PhoneInput } from '@/components/PhoneInput'
import { Badge, Button, Card, Field, SectionTitle, Spinner } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { useTenantOverview, useUpdateCompany } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { ENGINE_META, VISIBLE_ENGINES, engineLabel } from '@/config/engineMeta'
import type { EngineKind } from '@/api/types'

const IDENTITY_FIELDS: { key: string; labelKey: string; hintKey?: string }[] = [
  { key: 'name', labelKey: 'common:label.tradingname', hintKey: 'admin:company.tradingNameHint' },
  { key: 'legalName', labelKey: 'common:label.legalname' },
  { key: 'crNumber', labelKey: 'common:label.crnumber' },
  { key: 'vatNumber', labelKey: 'common:label.vatnumber' },
]

const CONTACT_FIELDS: { key: string; labelKey: string }[] = [
  { key: 'address', labelKey: 'common:label.address' },
  { key: 'city', labelKey: 'common:label.city' },
  { key: 'country', labelKey: 'common:label.country' },
  { key: 'phone', labelKey: 'common:label.phone' },
  { key: 'email', labelKey: 'common:label.email' },
  { key: 'website', labelKey: 'common:label.website' },
]

export function AdminCompany() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, isLoading } = useTenantOverview()
  const update = useUpdateCompany()

  const [identity, setIdentity] = useState<Record<string, string>>({})
  const [contact, setContact] = useState<Record<string, string>>({})
  const [vatRate, setVatRate] = useState('')
  const [currency, setCurrency] = useState('')
  const [engines, setEngines] = useState<EngineKind[]>([])

  useEffect(() => {
    if (!data) return
    const t = data.tenant
    setIdentity({ name: t.name, legalName: t.legalName, crNumber: t.crNumber, vatNumber: t.vatNumber })
    setContact({ ...t.company })
    setVatRate(String(Math.round(t.vatRate * 100)))
    setCurrency(t.currency)
    setEngines([...t.enabledEngines])
  }, [data])

  if (isLoading || !data) {
    return (
      <div data-testid="admin-company">
        <PageHeader title={t('company.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const toggleEngine = (e: EngineKind) =>
    setEngines((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))

  const save = () => {
    const rate = Number(vatRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast('danger', t('company.vatRange'))
      return
    }
    update.mutate(
      {
        ...identity,
        currency: currency.trim().toUpperCase(),
        vatRate: rate / 100,
        enabledEngines: engines,
        company: contact,
      },
      {
        onSuccess: () => toast('success', t('company.saved'), t('company.savedDetail')),
        onError: (e) => toast('danger', 'Could not save', e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  return (
    <div data-testid="admin-company">
      <PageHeader
        title={t('company.title')}
        subtitle={t('company.subtitle')}
        crumbs={[{ label: t('common:crumb.tenantadmin') }, { label: t('common:crumb.company') }]}
        helpId="admin-company"
        actions={
          <Button onClick={save} loading={update.isPending} data-testid="admin-company-save">
            <Save size={16} /> {t('common:action.saveChanges')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Card className="p-4">
          <SectionTitle className="mb-3 flex items-center gap-2">
            <Building2 size={16} />{t('company.legalIdentity')}</SectionTitle>
          {IDENTITY_FIELDS.map((f) => (
            <Field key={f.key} label={t(f.labelKey)} hint={f.hintKey ? t(f.hintKey) : undefined}>
              <input
                className="lf-input"
                value={identity[f.key] ?? ''}
                onChange={(ev) => setIdentity({ ...identity, [f.key]: ev.target.value })}
                data-testid={`company-${f.key}`}
              />
            </Field>
          ))}

          <SectionTitle className="mt-4 mb-3">{t('company.money')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label={t('company.vatPercent')} hint={t('company.vatHint')}>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                className="lf-input tabular-nums"
                value={vatRate}
                onChange={(ev) => setVatRate(ev.target.value)}
                data-testid="company-vat"
              />
            </Field>
            <Field label={t('company.currency')} hint={t('company.currencyHint')}>
              <input
                className="lf-input uppercase"
                maxLength={3}
                value={currency}
                onChange={(ev) => setCurrency(ev.target.value)}
                data-testid="company-currency"
              />
            </Field>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-4">
            <SectionTitle className="mb-3 flex items-center gap-2">
              <Building2 size={16} />{t('company.contact')}</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              {CONTACT_FIELDS.map((f) => (
                <Field key={f.key} label={t(f.labelKey)}>
                  {f.key === 'phone' ? (
                    <PhoneInput
                      value={contact[f.key] ?? ''}
                      onChange={(v) => setContact({ ...contact, [f.key]: v })}
                      testId="company-contact-phone"
                    />
                  ) : (
                    <input
                      className="lf-input"
                      value={contact[f.key] ?? ''}
                      onChange={(ev) => setContact({ ...contact, [f.key]: ev.target.value })}
                      data-testid={`company-contact-${f.key}`}
                    />
                  )}
                </Field>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle className="mb-1 flex items-center gap-2">
              <ToggleRight size={16} />{t('company.servicesYouOffer')}</SectionTitle>
            <p className="text-xs text-muted mb-3">
              {t('company.servicesNote')}
            </p>
            <div className="flex flex-col gap-2">
              {VISIBLE_ENGINES.map((e) => {
                const on = engines.includes(e)
                const stat = data.byEngine.find((b) => b.engineKind === e)
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => toggleEngine(e)}
                    data-testid={`company-engine-${e}`}
                    className={clsx(
                      'lf-card p-3 flex items-center justify-between gap-3 text-left transition-colors',
                      on ? 'border-brand ring-1 ring-brand/30 bg-brand/5' : 'hover:border-brand opacity-70',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-dk-texthi">
                      <Icon name={ENGINE_META[e].icon} size={16} className={on ? 'text-brand' : 'text-muted'} />
                      {engineLabel(e)}
                    </span>
                    <span className="flex items-center gap-2">
                      {stat && <span className="text-[11px] text-muted">{t('company.unitCount', { count: stat.units })}</span>}
                      <Badge tone={on ? 'success' : 'neutral'}>{on ? 'On' : 'Off'}</Badge>
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle className="mb-3 flex items-center gap-2">
              <Palette size={16} />{t('company.branding')}</SectionTitle>
            <p className="text-sm text-muted">
              {t('company.brandingNote')}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(data.tenant.branding ?? {})
                .filter(([, v]) => typeof v === 'string' && v.startsWith('#'))
                .map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 lf-card px-3 py-2">
                    <span className="w-5 h-5 rounded border border-line" style={{ backgroundColor: v }} />
                    <span className="text-xs text-muted">{t(`company.${k}`, { defaultValue: k })}</span>
                    <span className="text-xs font-mono">{v}</span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
