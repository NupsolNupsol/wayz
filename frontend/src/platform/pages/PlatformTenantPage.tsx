import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  Database,
  ExternalLink,
  MapPin,
  Play,
  Power,
  RotateCw,
  Save,
  ScrollText,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'

import { ApiError } from '@/api/client'
import {
  platformApi,
  type CapabilityDef,
  type PlatformAuditRow,
  type PlatformTenant,
  type ProfileDef,
  type TenantEstateRow,
  type TenantStructure,
} from '../platformApi'
import { BrandingEditor } from '../BrandingEditor'
import { CapabilityPicker } from '../CapabilityPicker'
import {
  DataTable,
  EmptyState,
  ErrorState,
  Labelled,
  PageHeader,
  Pill,
  PlatformButton,
  PlatformCard,
  Skeleton,
  StatCard,
  StatusDot,
  Td,
  TextInput,
  Th,
  bytes,
  when,
} from '../components'
import { ConfirmDialog, useToast } from '../toast'

/**
 * One tenant, as a workspace rather than a page.
 *
 * Everything a platform operator does to a company is here and is grouped the way the work
 * divides: identity is not brand, brand is not capability, and the destructive actions are
 * somewhere you have to go rather than somewhere you can slip.
 *
 * Nothing on this screen reads a tenant's operational records. The Structure and
 * Administrators tabs read that tenant's *shape* — where it operates, who administers it —
 * live through its own connection, and copy nothing into the control plane.
 */

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'company', label: 'Company & legal' },
  { key: 'branding', label: 'Branding' },
  { key: 'capabilities', label: 'Capabilities & jobs' },
  { key: 'structure', label: 'Structure' },
  { key: 'administrators', label: 'Administrators' },
  { key: 'provisioning', label: 'Provisioning' },
  { key: 'audit', label: 'Changes' },
] as const

type TabKey = (typeof TABS)[number]['key']

const LIFECYCLE_TONE: Record<string, 'live' | 'warn' | 'bad' | 'quiet'> = {
  ACTIVE: 'live',
  PROVISIONING: 'warn',
  SUSPENDED: 'bad',
  FAILED: 'bad',
  ARCHIVED: 'quiet',
}

export function PlatformTenantPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { say } = useToast()
  const [params, setParams] = useSearchParams()

  const justCreated = params.get('created') === '1'
  const tab = (params.get('tab') as TabKey) || 'overview'
  const setTab = (next: TabKey) => setParams((p) => {
    const q = new URLSearchParams(p)
    q.set('tab', next)
    q.delete('created')
    return q
  })

  const [tenant, setTenant] = useState<PlatformTenant | null>(null)
  const [vocab, setVocab] = useState<{ capabilities: CapabilityDef[]; profiles: ProfileDef[] } | null>(null)
  const [audit, setAudit] = useState<PlatformAuditRow[]>([])
  const [structure, setStructure] = useState<TenantStructure | null>(null)
  const [estate, setEstate] = useState<TenantEstateRow | null>(null)

  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [invoice, setInvoice] = useState<PlatformTenant['invoice'] | null>(null)
  const [branding, setBranding] = useState<PlatformTenant['branding'] | null>(null)
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [profiles, setProfiles] = useState<string[]>([])

  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [fatal, setFatal] = useState('')

  const [suspending, setSuspending] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [removing, setRemoving] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState('')

  const adopt = useCallback((t: PlatformTenant) => {
    setTenant(t)
    setName(t.name)
    setNameAr(t.nameAr)
    setInvoice(t.invoice)
    setBranding(t.branding)
    setCapabilities(t.capabilities)
    setProfiles(t.enabledProfiles)
  }, [])

  const refreshAudit = useCallback(() => {
    platformApi.audit({ tenantId: id, limit: 60 }).then((r) => setAudit(r.rows)).catch(() => undefined)
  }, [id])

  const load = useCallback(() => {
    setFatal('')
    platformApi
      .tenant(id)
      .then(adopt)
      .catch((e) => setFatal(e instanceof ApiError ? e.message : 'That tenant could not be loaded.'))
    platformApi.vocabulary().then(setVocab).catch(() => undefined)
    platformApi.structure(id).then(setStructure).catch(() => setStructure(null))
    platformApi
      .reports()
      .then((r) => setEstate(r.estate.find((e) => e.slug === id) ?? null))
      .catch(() => setEstate(null))
    refreshAudit()
  }, [id, adopt, refreshAudit])

  useEffect(load, [load])

  const dirty = useMemo(() => {
    if (!tenant || !branding || !invoice) return false
    return (
      name !== tenant.name ||
      nameAr !== tenant.nameAr ||
      JSON.stringify(branding) !== JSON.stringify(tenant.branding) ||
      JSON.stringify(invoice) !== JSON.stringify(tenant.invoice) ||
      JSON.stringify([...capabilities].sort()) !== JSON.stringify([...tenant.capabilities].sort()) ||
      JSON.stringify([...profiles].sort()) !== JSON.stringify([...tenant.enabledProfiles].sort())
    )
  }, [tenant, name, nameAr, branding, invoice, capabilities, profiles])

  if (fatal) return <ErrorState message={fatal} onRetry={load} testId="platform-tenant-error" />
  if (!tenant || !branding || !invoice) return <Skeleton rows={5} testId="platform-tenant-loading" />

  const failedStep = tenant.provisioning.steps.find((s) => s.status === 'FAILED')
  const incomplete = tenant.provisioning.done < tenant.provisioning.total

  const save = async () => {
    setBusy(true)
    setProblem('')
    try {
      adopt(await platformApi.update(id, { name, nameAr, invoice, branding, capabilities, enabledProfiles: profiles }))
      say(`${name} saved.`)
      refreshAudit()
    } catch (e) {
      const message = e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'That could not be saved.'
      setProblem(message)
      say(message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  const retry = async () => {
    setBusy(true)
    try {
      adopt(await platformApi.retryProvisioning(id))
      say('Provisioning resumed.')
      refreshAudit()
    } catch (e) {
      say(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'Provisioning could not be resumed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const flipLifecycle = async () => {
    const isSuspending = tenant.lifecycle !== 'SUSPENDED'
    setBusy(true)
    try {
      adopt(await platformApi.setLifecycle(id, isSuspending ? 'SUSPENDED' : 'ACTIVE', suspendReason || undefined))
      say(isSuspending ? `${tenant.name} suspended. Their staff are signed out.` : `${tenant.name} is live again.`)
      setSuspending(false)
      setSuspendReason('')
      refreshAudit()
    } catch (e) {
      say(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'That could not be changed.', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await platformApi.remove(id, removeConfirm)
      say(`${tenant.name} was removed and its database dropped.`)
      navigate('/platform/tenants', { replace: true })
    } catch (e) {
      say(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'That tenant could not be removed.', 'bad')
      setBusy(false)
    }
  }

  const stationsOf = (siteId: string) => structure?.stations.filter((s) => s.siteId === siteId) ?? []
  const kiosksOf = (stationId: string) => structure?.kiosks.filter((k) => k.stationId === stationId) ?? []
  const gatesOf = (stationId: string) => structure?.gates.filter((g) => g.stationId === stationId) ?? []

  return (
    <div data-testid="platform-tenant-page">
      {justCreated && (
        <div
          className="rounded-xl border border-success/25 bg-success/[0.08] p-3.5 mb-4 flex items-start gap-2.5"
          data-testid="platform-tenant-created"
        >
          <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <p className="font-semibold text-success">{tenant.name} is provisioned.</p>
            <p className="text-success/60 mt-0.5">
              Its staff sign in at{' '}
              <a href={tenant.loginPath} className="underline" target="_blank" rel="noreferrer">
                {tenant.loginPath}
              </a>
              . Its stations, staff and catalogue are its own administrator's to set up.
            </p>
          </div>
        </div>
      )}

      <PageHeader
        title={tenant.name}
        blurb={tenant.nameAr || undefined}
        actions={
          <>
            <a href={tenant.loginPath} target="_blank" rel="noreferrer">
              <PlatformButton variant="ghost" testId="platform-open-tenant-login">
                <ExternalLink size={15} /> Sign-in page
              </PlatformButton>
            </a>
            <PlatformButton onClick={save} busy={busy} disabled={!dirty} testId="platform-save-tenant">
              <Save size={15} /> {dirty ? 'Save changes' : 'Saved'}
            </PlatformButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5 text-[12px]">
        <Pill tone={LIFECYCLE_TONE[tenant.lifecycle] ?? 'quiet'} testId="tenant-lifecycle">
          <StatusDot
            state={tenant.lifecycle === 'ACTIVE' ? 'good' : tenant.lifecycle === 'PROVISIONING' ? 'warn' : 'bad'}
            label={tenant.lifecycle.toLowerCase()}
          />
        </Pill>
        <span className="font-mono text-muted">{tenant.dbName}</span>
        <span className="text-muted">·</span>
        <span className="font-mono text-muted">/t/{tenant.slug}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">created {when(tenant.createdAt)}</span>
      </div>

      {failedStep && (
        <div className="rounded-xl border border-danger-strong/25 bg-danger-strong/[0.08] p-3.5 mb-5 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-danger-strong shrink-0 mt-0.5" />
          <div className="text-[13px] min-w-0 flex-1">
            <p className="font-semibold text-danger-strong">Provisioning stopped at {failedStep.step}</p>
            <p className="text-danger-strong/60 mt-0.5">{failedStep.error ?? tenant.provisioning.lastError}</p>
          </div>
          <PlatformButton variant="ghost" onClick={retry} busy={busy} testId="platform-retry-provisioning">
            <Play size={14} /> Resume
          </PlatformButton>
        </div>
      )}

      <div className="flex gap-1 mb-5 overflow-x-auto border-b border-line -mx-1 px-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tenant-tab-${t.key}`}
            className={
              tab === t.key
                ? 'px-3.5 h-10 text-[13px] font-semibold border-b-2 border-brand text-ink whitespace-nowrap'
                : 'px-3.5 h-10 text-[13px] font-medium border-b-2 border-transparent text-muted hover:text-ink whitespace-nowrap'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {problem && (
        <div className="rounded-xl border border-danger-strong/25 bg-danger-strong/[0.07] p-3 mb-4 text-[13px] text-danger-strong">
          {problem}
        </div>
      )}

      {tab === 'overview' && (
        <div data-testid="tenant-tab-panel-overview">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-5">
            <StatCard
              label="Database"
              value={estate ? (estate.reachable ? 'Reachable' : 'Not answering') : null}
              unavailable="Checking…"
              hint={tenant.dbName}
              icon={Database}
              tone={estate?.reachable ? 'good' : estate ? 'bad' : 'quiet'}
              testId="tenant-kpi-database"
            />
            <StatCard
              label="Data stored"
              value={estate ? bytes(estate.storageBytes) : null}
              unavailable="Not available"
              hint={estate?.collections !== null && estate ? `${estate.collections} collections` : undefined}
              icon={Database}
              tone="quiet"
              testId="tenant-kpi-storage"
            />
            <StatCard
              label="People"
              value={structure ? structure.staffCount : null}
              unavailable="Not available"
              hint={structure ? `${structure.admins.length} administrator${structure.admins.length === 1 ? '' : 's'}` : undefined}
              icon={Users}
              tone="quiet"
              testId="tenant-kpi-people"
            />
            <StatCard
              label="Estate"
              value={structure ? `${structure.sites.length} / ${structure.stations.length}` : null}
              unavailable="Not available"
              hint="Sites / stations"
              icon={MapPin}
              tone="quiet"
              testId="tenant-kpi-estate"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PlatformCard testId="tenant-identity">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-4">Identity</h2>
              <Labelled label="Name">
                <TextInput value={name} onChange={setName} testId="tenant-name" />
              </Labelled>
              <Labelled label="Name in Arabic">
                <TextInput value={nameAr} onChange={setNameAr} dir="rtl" testId="tenant-name-ar" />
              </Labelled>
              <div className="text-[12px] text-muted space-y-1 pt-1">
                <p>
                  Handle <span className="font-mono text-muted">{tenant.slug}</span> — fixed. It names the database
                  and the sign-in address, so it cannot change once the tenant exists.
                </p>
              </div>
            </PlatformCard>

            <PlatformCard testId="tenant-lifecycle-card">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-3">Lifecycle</h2>
              {tenant.suspendedReason && (
                <p className="text-[13px] text-danger-strong mb-3 rounded-lg bg-danger-strong/[0.08] p-2.5">
                  Suspended: {tenant.suspendedReason}
                </p>
              )}
              <p className="text-[13px] text-muted mb-4">
                {tenant.lifecycle === 'SUSPENDED'
                  ? 'Nobody at this company can sign in. Their data is untouched and returns exactly as it was.'
                  : 'Suspending signs out every member of staff immediately. Nothing is deleted.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <PlatformButton
                  variant={tenant.lifecycle === 'SUSPENDED' ? 'primary' : 'ghost'}
                  onClick={() => (tenant.lifecycle === 'SUSPENDED' ? flipLifecycle() : setSuspending(true))}
                  busy={busy}
                  testId="platform-toggle-lifecycle"
                >
                  <Power size={15} /> {tenant.lifecycle === 'SUSPENDED' ? 'Restore' : 'Suspend'}
                </PlatformButton>
                {incomplete && (
                  <PlatformButton variant="ghost" onClick={retry} busy={busy} testId="platform-resume-provisioning">
                    <RotateCw size={15} /> Resume provisioning
                  </PlatformButton>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-line">
                <p className="text-[11px] font-bold uppercase tracking-wider text-danger-strong/70 mb-2">Permanent</p>
                <p className="text-[12px] text-muted mb-3">
                  Removing drops <span className="font-mono">{tenant.dbName}</span> and everything in it. It can only
                  be done to a suspended tenant, and the handle has to be typed back.
                </p>
                <PlatformButton
                  variant="danger"
                  onClick={() => {
                    setRemoveConfirm('')
                    setRemoving(true)
                  }}
                  disabled={tenant.lifecycle !== 'SUSPENDED'}
                  testId="platform-remove-tenant"
                >
                  <Trash2 size={15} /> Remove tenant
                </PlatformButton>
              </div>
            </PlatformCard>
          </div>
        </div>
      )}

      {tab === 'company' && (
        <PlatformCard testId="tenant-tab-panel-company">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-1">Company & legal</h2>
          <p className="text-[12px] text-muted mb-5">
            What appears on this tenant's invoices. Every field is theirs, not the platform's.
          </p>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Labelled label="Legal name">
              <TextInput
                value={invoice.legalName ?? ''}
                onChange={(v) => setInvoice({ ...invoice, legalName: v })}
                testId="tenant-legal-name"
              />
            </Labelled>
            <Labelled label="Legal name in Arabic">
              <TextInput
                value={invoice.legalNameAr ?? ''}
                onChange={(v) => setInvoice({ ...invoice, legalNameAr: v })}
                dir="rtl"
                testId="tenant-legal-name-ar"
              />
            </Labelled>
            <Labelled label="Commercial registration">
              <TextInput
                value={invoice.crNumber ?? ''}
                onChange={(v) => setInvoice({ ...invoice, crNumber: v })}
                testId="tenant-cr"
              />
            </Labelled>
            <Labelled label="VAT number">
              <TextInput
                value={invoice.vatNumber ?? ''}
                onChange={(v) => setInvoice({ ...invoice, vatNumber: v })}
                testId="tenant-vat"
              />
            </Labelled>
            <Labelled label="Address">
              <TextInput
                value={invoice.address ?? ''}
                onChange={(v) => setInvoice({ ...invoice, address: v })}
                testId="tenant-address"
              />
            </Labelled>
            <Labelled label="Address in Arabic">
              <TextInput
                value={invoice.addressAr ?? ''}
                onChange={(v) => setInvoice({ ...invoice, addressAr: v })}
                dir="rtl"
                testId="tenant-address-ar"
              />
            </Labelled>
            <Labelled label="Phone">
              <TextInput
                value={invoice.phone ?? ''}
                onChange={(v) => setInvoice({ ...invoice, phone: v })}
                testId="tenant-phone"
              />
            </Labelled>
            <Labelled label="Email">
              <TextInput
                value={invoice.email ?? ''}
                onChange={(v) => setInvoice({ ...invoice, email: v })}
                testId="tenant-email"
              />
            </Labelled>
          </div>
          <div className="text-[12px] text-muted pt-1">
            Currency <span className="font-mono text-muted">{tenant.currency}</span> · timezone{' '}
            <span className="font-mono text-muted">{tenant.timezone}</span> · languages{' '}
            <span className="font-mono text-muted">
              {tenant.locale}/{tenant.secondaryLocale}
            </span>
          </div>
        </PlatformCard>
      )}

      {tab === 'branding' && (
        <PlatformCard testId="tenant-tab-panel-branding">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-1">Branding</h2>
          <p className="text-[12px] text-muted mb-5">
            What this tenant's staff see from the sign-in page onward. Saved here, worn on their next page load —
            nothing is rebuilt or redeployed.
          </p>
          <BrandingEditor value={branding} onChange={setBranding} tenantName={name} />
        </PlatformCard>
      )}

      {tab === 'capabilities' && (
        <PlatformCard testId="tenant-tab-panel-capabilities">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-1">Capabilities & jobs</h2>
          <p className="text-[12px] text-muted mb-5">
            What this business does, and which jobs follow from it. A job that needs a capability the tenant does not
            hold is not offered — that is how a company running horse tours is never shown a lagoon captain.
          </p>
          <CapabilityPicker
            vocabulary={vocab}
            capabilities={capabilities}
            profiles={profiles}
            onCapabilities={setCapabilities}
            onProfiles={setProfiles}
          />
        </PlatformCard>
      )}

      {tab === 'structure' && (
        <div data-testid="tenant-tab-panel-structure">
          <div
            className="rounded-xl border border-line bg-canvas p-3 mb-4 text-[12px] text-muted"
          >
            Read live from {tenant.dbName} at the moment this page loaded. Nothing is copied into the control plane,
            and no booking, payment or customer is read.
          </div>

          {!structure ? (
            <Skeleton rows={3} testId="tenant-structure-loading" />
          ) : structure.sites.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No estate yet"
              blurb="Provisioning deliberately creates no sites or stations: where a company operates is configuration it owns. Its administrator builds this from inside their own workspace."
              action={
                <a href={tenant.loginPath} target="_blank" rel="noreferrer">
                  <PlatformButton variant="ghost">
                    <ExternalLink size={15} /> Their sign-in page
                  </PlatformButton>
                </a>
              }
              testId="tenant-structure-empty"
            />
          ) : (
            <div className="space-y-3">
              {structure.sites.map((site) => (
                <PlatformCard key={site._id} testId={`tenant-site-${site._id}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={15} className="text-muted" />
                    <span className="font-semibold text-[14px]">{site.name}</span>
                    {site.city && <span className="text-[12px] text-muted">· {site.city}</span>}
                  </div>
                  {stationsOf(site._id).length === 0 ? (
                    <p className="text-[12px] text-muted ps-6">No stations here yet.</p>
                  ) : (
                    <div className="space-y-2 ps-6">
                      {stationsOf(site._id).map((station) => (
                        <div key={station._id} className="border-s border-line ps-3.5 py-1">
                          <p className="text-[13px] font-medium">{station.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {kiosksOf(station._id).map((k) => (
                              <span
                                key={k._id}
                                className="rounded-md bg-canvas px-2 py-0.5 text-[11px] text-muted"
                              >
                                {k.name}
                              </span>
                            ))}
                            {gatesOf(station._id).map((g) => (
                              <span
                                key={g._id}
                                className="rounded-md bg-brand/10 text-brand px-2 py-0.5 text-[11px]"
                              >
                                {g.name}
                              </span>
                            ))}
                            {kiosksOf(station._id).length === 0 && gatesOf(station._id).length === 0 && (
                              <span className="text-[11px] text-muted">no desks or gates</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </PlatformCard>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'administrators' && (
        <div data-testid="tenant-tab-panel-administrators">
          <div className="rounded-xl border border-line bg-canvas p-3 mb-4 text-[12px] text-muted">
            This tenant's own administrators, read live from its database. They administer their company; they cannot
            reach the control plane, because a tenant credential and a platform credential are different kinds of
            thing rather than the same kind with a flag.
          </div>

          {!structure ? (
            <Skeleton rows={2} testId="tenant-admins-loading" />
          ) : structure.admins.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No administrator"
              blurb="Every tenant should have at least one. Resume provisioning to create the one this tenant was set up with."
              action={
                <PlatformButton variant="ghost" onClick={retry} busy={busy}>
                  <RotateCw size={15} /> Resume provisioning
                </PlatformButton>
              }
              testId="tenant-admins-empty"
            />
          ) : (
            <DataTable
              testId="tenant-admins-table"
              head={
                <>
                  <Th>Administrator</Th>
                  <Th>Status</Th>
                  <Th>Last signed in</Th>
                  <Th>Added</Th>
                </>
              }
            >
              {structure.admins.map((a) => (
                <tr key={a._id} data-testid={`tenant-admin-${a.email}`}>
                  <Td>
                    <span className="font-semibold block">{a.fullName}</span>
                    <span className="text-[11px] text-muted">{a.email}</span>
                  </Td>
                  <Td>
                    <Pill tone={a.active ? 'live' : 'bad'}>{a.active ? 'active' : 'suspended'}</Pill>
                  </Td>
                  <Td className="text-muted text-[12px]">{a.lastLoginAt ? when(a.lastLoginAt) : 'never'}</Td>
                  <Td className="text-muted text-[12px]">{when(a.createdAt ?? null)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      )}

      {tab === 'provisioning' && (
        <PlatformCard testId="tenant-tab-panel-provisioning">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">Provisioning</h2>
              <p className="text-[12px] text-muted mt-1">
                Each step is recorded on its own, so a run that stops part way says exactly where. Resuming is safe:
                finished steps are not repeated.
              </p>
            </div>
            {incomplete && (
              <PlatformButton variant="ghost" onClick={retry} busy={busy} testId="platform-retry-provisioning">
                <Play size={14} /> Resume
              </PlatformButton>
            )}
          </div>

          <div className="space-y-1.5">
            {tenant.provisioning.steps.map((s) => (
              <div
                key={s.step}
                className="flex items-center gap-3 rounded-xl bg-canvas px-3.5 py-2.5"
                data-testid={`provisioning-step-${s.step}`}
              >
                {s.status === 'DONE' ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : s.status === 'FAILED' ? (
                  <XCircle size={15} className="text-rose-400 shrink-0" />
                ) : (
                  <Circle size={15} className="text-muted shrink-0" />
                )}
                <span className="text-[13px] font-medium flex-1 min-w-0">
                  {s.step}
                  {s.error && <span className="block text-[11px] text-danger-strong mt-0.5">{s.error}</span>}
                </span>
                <span className="text-[11px] text-muted shrink-0">{s.at ? when(s.at) : '—'}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 mt-5 text-[12px]">
            <div>
              <p className="text-muted">Started</p>
              <p className="text-ink">{when(tenant.provisioning.startedAt)}</p>
            </div>
            <div>
              <p className="text-muted">Completed</p>
              <p className="text-ink">{when(tenant.provisioning.completedAt)}</p>
            </div>
            <div>
              <p className="text-muted">Steps done</p>
              <p className="text-ink">
                {tenant.provisioning.done} of {tenant.provisioning.total}
              </p>
            </div>
          </div>
        </PlatformCard>
      )}

      {tab === 'audit' && (
        <div data-testid="tenant-tab-panel-audit">
          {audit.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Nothing recorded for this tenant"
              blurb="Changes made from the control plane appear here as they happen."
              testId="tenant-audit-empty"
            />
          ) : (
            <>
              <DataTable
                testId="tenant-audit-table"
                head={
                  <>
                    <Th>When</Th>
                    <Th>Who</Th>
                    <Th>Action</Th>
                    <Th>What changed</Th>
                  </>
                }
              >
                {audit.map((a) => (
                  <tr key={a._id} data-testid="tenant-audit-row">
                    <Td className="whitespace-nowrap text-muted text-[12px]">{when(a.at)}</Td>
                    <Td className="text-ink">{a.actorEmail || a.actorId}</Td>
                    <Td>
                      <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-mono font-semibold">
                        {a.action}
                      </span>
                    </Td>
                    <Td className="text-muted">{a.detail || '—'}</Td>
                  </tr>
                ))}
              </DataTable>
              <Link
                to={`/platform/audit?tenantId=${tenant.id}`}
                className="inline-block mt-3 text-[13px] text-brand hover:text-brand"
              >
                Open in the full audit log
              </Link>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={suspending}
        title={`Suspend ${tenant.name}?`}
        confirmLabel="Suspend"
        tone="danger"
        busy={busy}
        onCancel={() => setSuspending(false)}
        onConfirm={flipLifecycle}
        body={
          <>
            <p>
              Every member of their staff is signed out immediately and cannot sign back in. Nothing is deleted, and
              restoring returns them to exactly this state.
            </p>
            <Labelled label="Reason" hint="Recorded in the audit log and shown on this page.">
              <TextInput value={suspendReason} onChange={setSuspendReason} testId="suspend-reason" />
            </Labelled>
          </>
        }
      />

      <ConfirmDialog
        open={removing}
        title={`Remove ${tenant.name} permanently?`}
        confirmLabel="Remove and drop the database"
        tone="danger"
        busy={busy || removeConfirm !== tenant.slug}
        onCancel={() => setRemoving(false)}
        onConfirm={remove}
        testId="platform-remove-confirm"
        body={
          <>
            <p>
              This drops <span className="font-mono text-ink">{tenant.dbName}</span> and everything inside it. It
              cannot be undone, and the handle <span className="font-mono text-ink">{tenant.slug}</span> is gone for
              good.
            </p>
            <Labelled label={`Type "${tenant.slug}" to confirm`}>
              <TextInput value={removeConfirm} onChange={setRemoveConfirm} testId="remove-confirm-input" />
            </Labelled>
          </>
        }
      />
    </div>
  )
}
