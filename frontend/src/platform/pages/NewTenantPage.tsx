import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'

import { ApiError } from '@/api/client'
import { platformApi, type CapabilityDef, type NewTenantInput, type ProfileDef } from '../platformApi'
import { BrandingEditor, defaultBranding } from '../BrandingEditor'
import { CapabilityPicker } from '../CapabilityPicker'
import { Labelled, PlatformButton, PlatformCard, SectionHeading, TextInput } from '../components'

/** A handle, derived from the name but always the admin's to change before it is fixed forever. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)

/**
 * Creating a company.
 *
 * One page rather than a multi-step wizard, because everything on it is needed before the
 * tenant can exist and a wizard would only hide how much that is. The order is the order
 * somebody actually has the information in: who they are, how they invoice, what they look
 * like, what they are allowed to do, and who runs it.
 */
export function NewTenantPage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  const [currency, setCurrency] = useState('SAR')
  const [timezone, setTimezone] = useState('Asia/Riyadh')
  const [locale, setLocale] = useState<'en' | 'ar'>('en')

  const [invoice, setInvoice] = useState({
    legalName: '',
    legalNameAr: '',
    crNumber: '',
    vatNumber: '',
    address: '',
    addressAr: '',
    phone: '',
    email: '',
    vatRate: 0.15,
  })

  const [branding, setBranding] = useState(defaultBranding)
  const [capabilities, setCapabilities] = useState<string[]>(['POS', 'ACTIVITIES', 'FINANCE'])
  const [profiles, setProfiles] = useState<string[]>(['TENANT_ADMIN', 'MANAGER', 'SUPERVISOR'])

  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const [vocab, setVocab] = useState<{ capabilities: CapabilityDef[]; profiles: ProfileDef[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [details, setDetails] = useState<string[]>([])

  useEffect(() => {
    platformApi.vocabulary().then(setVocab).catch(() => setVocab({ capabilities: [], profiles: [] }))
  }, [])

  const handle = slugTouched ? slug : slugify(name)

  const ready = useMemo(
    () =>
      name.trim().length >= 2 &&
      /^[a-z][a-z0-9-]{1,30}$/.test(handle) &&
      adminName.trim().length >= 2 &&
      /.+@.+\..+/.test(adminEmail) &&
      adminPassword.length >= 8 &&
      capabilities.length > 0 &&
      profiles.includes('TENANT_ADMIN'),
    [name, handle, adminName, adminEmail, adminPassword, capabilities, profiles],
  )

  /**
   * What is still missing, said out loud.
   *
   * A disabled Create button with no explanation is the commonest way a form wastes somebody's
   * time: they have filled in eleven fields, the button is grey, and nothing says which of the
   * twelfth they missed. Each of these is a real precondition for the tenant existing.
   */
  const missing = useMemo(() => {
    const gaps: string[] = []
    if (name.trim().length < 2) gaps.push('a company name')
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(handle)) gaps.push('a valid handle')
    if (capabilities.length === 0) gaps.push('at least one capability')
    if (!profiles.includes('TENANT_ADMIN')) gaps.push('the tenant administrator job')
    if (adminName.trim().length < 2) gaps.push("the first administrator's name")
    if (!/.+@.+\..+/.test(adminEmail)) gaps.push("the first administrator's email")
    if (adminPassword.length < 8) gaps.push('a password of at least 8 characters')
    return gaps
  }, [name, handle, capabilities, profiles, adminName, adminEmail, adminPassword])

  const submit = async () => {
    setBusy(true)
    setProblem('')
    setDetails([])
    const payload: NewTenantInput = {
      slug: handle,
      name: name.trim(),
      nameAr: nameAr.trim() || undefined,
      currency,
      timezone,
      locale,
      secondaryLocale: locale === 'en' ? 'ar' : 'en',
      invoice: { ...invoice, legalName: invoice.legalName.trim() || name.trim() },
      branding,
      capabilities,
      enabledProfiles: profiles,
      admin: { email: adminEmail.trim(), fullName: adminName.trim(), password: adminPassword },
    }
    try {
      const created = await platformApi.create(payload)
      navigate(`/platform/tenants/${created.id}?created=1`, { replace: true })
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : 'Could not create the tenant.')
      setDetails(err instanceof ApiError ? (err.errors ?? []) : [])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="platform-new-tenant-page">
      <button
        onClick={() => navigate('/platform/tenants')}
        className="text-sm text-muted hover:text-ink flex items-center gap-1.5 mb-4"
      >
        <ArrowLeft size={15} /> All tenants
      </button>

      <h1 className="text-2xl font-extrabold mb-1">New tenant</h1>
      <p className="text-sm text-muted mb-6">
        Creates the company, its own database, and the first person who can sign in to it.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <PlatformCard testId="new-tenant-identity">
            <SectionHeading title="Identity" blurb="What the company is called, and the handle it keeps forever." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Labelled label="Company name">
                <TextInput value={name} onChange={setName} placeholder="WIQAR" testId="new-tenant-name" />
              </Labelled>
              <Labelled label="Company name (Arabic)">
                <TextInput value={nameAr} onChange={setNameAr} dir="rtl" placeholder="وقار" testId="new-tenant-name-ar" />
              </Labelled>
            </div>
            <Labelled
              label="Handle"
              hint="Becomes the sign-in address and the database name, so it cannot be changed later."
              problem={handle && !/^[a-z][a-z0-9-]{1,30}$/.test(handle) ? 'Lowercase letters, digits and hyphens, starting with a letter.' : undefined}
            >
              <TextInput
                value={handle}
                onChange={(v) => {
                  setSlugTouched(true)
                  setSlug(v)
                }}
                placeholder="wiqar"
                testId="new-tenant-slug"
              />
            </Labelled>
            <p className="text-[11px] text-muted -mt-2 font-mono">
              /t/{handle || '…'}/login · lockerflow_t_{(handle || '…').replaceAll('-', '_')}
            </p>
          </PlatformCard>

          <PlatformCard testId="new-tenant-invoice">
            <SectionHeading title="Legal & invoice identity" blurb="What appears on their invoices and receipts." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Labelled label="Legal name" hint="Defaults to the company name.">
                <TextInput value={invoice.legalName} onChange={(v) => setInvoice({ ...invoice, legalName: v })} testId="new-tenant-legal-name" />
              </Labelled>
              <Labelled label="Legal name (Arabic)">
                <TextInput value={invoice.legalNameAr} onChange={(v) => setInvoice({ ...invoice, legalNameAr: v })} dir="rtl" testId="new-tenant-legal-name-ar" />
              </Labelled>
              <Labelled label="Commercial registration">
                <TextInput value={invoice.crNumber} onChange={(v) => setInvoice({ ...invoice, crNumber: v })} testId="new-tenant-cr" />
              </Labelled>
              <Labelled label="VAT number">
                <TextInput value={invoice.vatNumber} onChange={(v) => setInvoice({ ...invoice, vatNumber: v })} testId="new-tenant-vat" />
              </Labelled>
              <Labelled label="Address">
                <TextInput value={invoice.address} onChange={(v) => setInvoice({ ...invoice, address: v })} testId="new-tenant-address" />
              </Labelled>
              <Labelled label="Address (Arabic)">
                <TextInput value={invoice.addressAr} onChange={(v) => setInvoice({ ...invoice, addressAr: v })} dir="rtl" testId="new-tenant-address-ar" />
              </Labelled>
              <Labelled label="Phone">
                <TextInput value={invoice.phone} onChange={(v) => setInvoice({ ...invoice, phone: v })} testId="new-tenant-phone" />
              </Labelled>
              <Labelled label="Email">
                <TextInput value={invoice.email} onChange={(v) => setInvoice({ ...invoice, email: v })} type="email" testId="new-tenant-email" />
              </Labelled>
              <Labelled label="Currency">
                <TextInput value={currency} onChange={(v) => setCurrency(v.toUpperCase().slice(0, 3))} testId="new-tenant-currency" />
              </Labelled>
              <Labelled label="Timezone">
                <TextInput value={timezone} onChange={setTimezone} testId="new-tenant-timezone" />
              </Labelled>
            </div>
            <Labelled label="Primary language" hint="The other one is still available to every user.">
              <div className="flex gap-2">
                {(['en', 'ar'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocale(l)}
                    data-testid={`new-tenant-locale-${l}`}
                    className={
                      locale === l
                        ? 'h-10 px-4 rounded-xl bg-brand text-brand-fg text-sm font-semibold'
                        : 'h-10 px-4 rounded-xl bg-canvas border border-line text-muted text-sm font-semibold'
                    }
                  >
                    {l === 'en' ? 'English' : 'العربية'}
                  </button>
                ))}
              </div>
            </Labelled>
          </PlatformCard>

          <PlatformCard testId="new-tenant-capabilities">
            <SectionHeading
              title="What they may do"
              blurb="Capabilities decide which jobs exist and what appears in their navigation."
            />
            <CapabilityPicker
              vocabulary={vocab}
              capabilities={capabilities}
              profiles={profiles}
              onCapabilities={setCapabilities}
              onProfiles={setProfiles}
            />
          </PlatformCard>

          <PlatformCard testId="new-tenant-admin">
            <SectionHeading
              title="First administrator"
              blurb="The one account that exists when the tenant is created. They hire everybody else."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Labelled label="Full name">
                <TextInput value={adminName} onChange={setAdminName} testId="new-tenant-admin-name" />
              </Labelled>
              <Labelled label="Email">
                <TextInput value={adminEmail} onChange={setAdminEmail} type="email" testId="new-tenant-admin-email" />
              </Labelled>
            </div>
            <Labelled label="Password" hint="At least 8 characters. They can change it once they are in.">
              <TextInput value={adminPassword} onChange={setAdminPassword} type="password" testId="new-tenant-admin-password" />
            </Labelled>
          </PlatformCard>

          {problem && (
            <PlatformCard className="border-danger-strong/25" testId="new-tenant-error">
              <p className="text-sm text-danger-strong font-semibold">{problem}</p>
              {details.map((d) => (
                <p key={d} className="text-xs text-danger-strong/70 mt-1">
                  {d}
                </p>
              ))}
            </PlatformCard>
          )}

          <div className="flex justify-end gap-2 pb-8">
            <PlatformButton variant="ghost" onClick={() => navigate('/platform/tenants')}>
              Cancel
            </PlatformButton>
            <PlatformButton onClick={submit} disabled={!ready} busy={busy} testId="new-tenant-submit">
              <Check size={16} /> Create & provision
            </PlatformButton>
          </div>
        </div>

        <div className="xl:sticky xl:top-5 flex flex-col gap-4">
          <BrandingEditor value={branding} onChange={setBranding} tenantName={name || 'Your company'} />

          {/*
            * Review, before anything irreversible happens.
            *
            * A handle becomes a database name and cannot be changed afterwards, so the last
            * thing somebody should see is a plain statement of what is about to be created —
            * not a summary of what they typed, but the consequences of it: the address, the
            * database, the jobs, and who will be able to sign in.
            */}
          <PlatformCard testId="new-tenant-review">
            <SectionHeading title="Review" blurb="What pressing the button brings into existence." />

            <dl className="text-[13px] space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted shrink-0">Company</dt>
                <dd className="font-semibold text-end truncate" data-testid="review-name">
                  {name.trim() || <span className="text-muted font-normal">not named yet</span>}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted shrink-0">Sign-in address</dt>
                <dd className="font-mono text-ink text-end truncate" data-testid="review-login">
                  {handle ? `/t/${handle}/login` : '—'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted shrink-0">Database</dt>
                <dd className="font-mono text-ink text-end truncate" data-testid="review-database">
                  {handle ? `lockerflow_t_${handle}` : '—'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted shrink-0">Capabilities</dt>
                <dd className="text-ink text-end" data-testid="review-capabilities">
                  {capabilities.length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted shrink-0">Jobs staffed</dt>
                <dd className="text-ink text-end" data-testid="review-profiles">
                  {profiles.length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted shrink-0">Administrator</dt>
                <dd className="text-ink text-end truncate" data-testid="review-admin">
                  {adminEmail.trim() || <span className="text-muted">—</span>}
                </dd>
              </div>
            </dl>

            <div className="mt-4 pt-4 border-t border-line">
              {missing.length > 0 ? (
                <div data-testid="new-tenant-missing">
                  <p className="text-[12px] font-semibold text-warning-strong/90 mb-1.5">Still needed</p>
                  <ul className="text-[12px] text-muted space-y-1">
                    {missing.map((m) => (
                      <li key={m} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-warning mt-[7px] shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[12px] text-success/80" data-testid="new-tenant-ready">
                  Ready. The handle <span className="font-mono">{handle}</span> is permanent once this is created.
                </p>
              )}
            </div>

            <PlatformButton
              onClick={submit}
              disabled={!ready}
              busy={busy}
              className="w-full mt-4"
              testId="new-tenant-provision"
            >
              <Check size={16} /> Create &amp; provision
            </PlatformButton>
          </PlatformCard>
        </div>
      </div>
    </div>
  )
}
