import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Info, Server, ShieldCheck } from 'lucide-react'

import { platformApi, type HealthReport } from '../platformApi'
import { PageHeader, PlatformCard, Skeleton, StatusDot } from '../components'

/**
 * Settings that belong to the installation, not to any tenant.
 *
 * Everything a *tenant* is configured with — its name, its brand, what it may do, who
 * administers it — is on that tenant's own page, because it is that tenant's configuration.
 * Duplicating it here would create a second place to change the same thing, and second places
 * are how two sources of truth start.
 *
 * What is left is genuinely platform-level, and most of it is deliberately read-only: how this
 * server is configured comes from its environment, which is the only place it can be changed
 * safely. Showing it here as an editable field would imply otherwise.
 */
export function PlatformSettingsPage() {
  const [health, setHealth] = useState<HealthReport | null>(null)

  useEffect(() => {
    platformApi.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  const Row = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 border-b border-line last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="text-[11px] text-muted mt-0.5 max-w-md">{hint}</p>}
      </div>
      <div className="text-[13px] text-ink font-mono shrink-0">{value}</div>
    </div>
  )

  return (
    <div data-testid="platform-settings">
      <PageHeader
        title="Settings"
        blurb="Configuration that belongs to this installation. A tenant's own settings live on that tenant's page."
      />

      <div
        className="rounded-xl border border-brand/20 bg-brand/[0.06] p-3 mb-5 flex items-start gap-2.5 text-[12px] text-ink"
        data-testid="platform-settings-notice"
      >
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          The values below come from this server's environment and are shown so an operator can
          confirm what the installation is running as. They are not editable here on purpose:
          changing how a server is configured belongs with the server, not behind a web form.
          No connection strings, keys or passwords are ever shown.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformCard testId="settings-runtime">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
            <Server size={14} /> This installation
          </h2>
          {!health ? (
            <Skeleton rows={2} />
          ) : (
            <div>
              <Row label="Mode" value={health.api.mode} hint="`live` disables every development shortcut." />
              <Row label="Runtime" value={health.api.nodeEnv} />
              <Row label="Version" value={health.api.version} />
              <Row label="Control-plane database" value={health.controlPlane.database} />
              <Row
                label="Control plane"
                value={<StatusDot state={health.controlPlane.status === 'UP' ? 'good' : 'bad'} label={health.controlPlane.status} />}
              />
              <Row label="Tenant databases" value={String(health.tenantDatabases.length)} />
            </div>
          )}
        </PlatformCard>

        <PlatformCard testId="settings-where">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
            <Building2 size={14} /> Where things are configured
          </h2>
          <p className="text-[13px] text-muted mb-4">
            Most of what an operator wants to change belongs to one tenant rather than to the
            platform. There is one place for each, and only one.
          </p>
          <ul className="space-y-2.5 text-[13px]">
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted/40 mt-[7px] shrink-0" />
              <span>
                <Link to="/platform/tenants" className="text-brand hover:text-brand font-medium">
                  A tenant's identity, brand, capabilities and jobs
                </Link>{' '}
                <span className="text-muted">— on that tenant's page.</span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted/40 mt-[7px] shrink-0" />
              <span>
                <Link to="/platform/administrators" className="text-brand hover:text-brand font-medium">
                  Who can administer the platform
                </Link>{' '}
                <span className="text-muted">— Administrators.</span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted/40 mt-[7px] shrink-0" />
              <span className="text-muted">
                A tenant's stations, staff, catalogue and pricing — inside that tenant's own
                workspace, by its own administrator. The control plane never enters it.
              </span>
            </li>
          </ul>
        </PlatformCard>
      </div>

      <PlatformCard className="mt-4" testId="settings-security">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
          <ShieldCheck size={14} /> Standing rules
        </h2>
        <ul className="space-y-2 text-[13px] text-muted">
          <li>· A tenant administrator's credential cannot reach the control plane — the two carry different audiences.</li>
          <li>· A tenant's database name comes from the registry, never from anything a client sends.</li>
          <li>· There is no public registration for a platform administrator.</li>
          <li>· Demonstration accounts exist only while this installation says it is a demonstration.</li>
        </ul>
      </PlatformCard>
    </div>
  )
}
