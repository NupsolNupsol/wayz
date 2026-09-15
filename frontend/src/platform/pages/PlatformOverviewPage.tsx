import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Building2,
  Database,
  HardDrive,
  Plus,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { platformApi, type PlatformOverview } from '../platformApi'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pill,
  PlatformButton,
  Skeleton,
  StatCard,
  StatusDot,
  Td,
  Th,
  bytes,
  when,
} from '../components'

/**
 * What the platform actually is, right now.
 *
 * Every figure on this page is counted from something real — the registry, each tenant's own
 * database, the audit log. Nothing is sampled, projected or generated, and a number that could
 * not be obtained says so instead of showing a plausible zero. See `operations.service.ts`.
 */

const LIFECYCLE_TONE: Record<string, 'live' | 'warn' | 'bad' | 'quiet'> = {
  ACTIVE: 'live',
  PROVISIONING: 'warn',
  SUSPENDED: 'bad',
  FAILED: 'bad',
  ARCHIVED: 'quiet',
}

export function PlatformOverviewPage() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    platformApi
      .overview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'The overview could not be loaded.'))
  }, [])

  useEffect(load, [load])

  if (error) return <ErrorState message={error} onRetry={load} testId="platform-overview-error" />
  if (!data) return <Skeleton rows={4} testId="platform-overview-loading" />

  const live = data.tenants.byLifecycle.ACTIVE ?? 0
  const unreachable = data.estate.databases - data.estate.reachable

  return (
    <div data-testid="platform-overview">
      <PageHeader
        title="Overview"
        blurb="Every figure here is measured from the registry and from each tenant's own database. Nothing is estimated."
        actions={
          <Link to="/platform/tenants/new">
            <PlatformButton testId="platform-new-tenant">
              <Plus size={15} /> New tenant
            </PlatformButton>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Tenants"
          value={data.tenants.total}
          hint={`${live} live${data.tenants.total - live > 0 ? ` · ${data.tenants.total - live} not live` : ''}`}
          icon={Building2}
          tone="info"
          testId="kpi-tenants"
        />
        <StatCard
          label="Tenant databases"
          value={data.estate.databases}
          hint={
            unreachable > 0
              ? `${unreachable} not answering — see System health`
              : 'All answering'
          }
          icon={Database}
          tone={unreachable > 0 ? 'bad' : 'good'}
          testId="kpi-databases"
        />
        <StatCard
          label="People who can sign in"
          value={data.people.tenantUsers}
          unavailable="Not available while a tenant database is unreachable"
          hint="Across every tenant, counted live"
          icon={Users}
          tone="quiet"
          testId="kpi-users"
        />
        <StatCard
          label="Data stored"
          value={bytes(data.estate.storageBytes)}
          unavailable="Not available while a tenant database is unreachable"
          hint="Reported by each database itself"
          icon={HardDrive}
          tone="quiet"
          testId="kpi-storage"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Platform administrators"
          value={data.people.platformAdmins}
          hint="Can reach every tenant"
          icon={ShieldCheck}
          tone="info"
          testId="kpi-admins"
        />
        <StatCard
          label="Provisioning failures"
          value={data.tenants.provisioningFailed}
          hint={data.tenants.provisioningFailed > 0 ? 'Needs attention' : 'Nothing stuck'}
          icon={Activity}
          tone={data.tenants.provisioningFailed > 0 ? 'bad' : 'good'}
          testId="kpi-provisioning"
        />
        <StatCard
          label="Audited actions"
          value={data.activity.auditEntriesLast7Days}
          hint="In the last seven days"
          icon={ScrollText}
          tone="quiet"
          testId="kpi-audit"
        />
        <StatCard
          label="Last recorded action"
          value={data.activity.lastEventAt ? when(data.activity.lastEventAt) : null}
          unavailable="Nothing recorded yet"
          icon={ScrollText}
          tone="quiet"
          testId="kpi-last-event"
        />
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">Most recently added</h2>
        <Link to="/platform/tenants" className="text-[13px] text-brand hover:text-brand">
          All tenants
        </Link>
      </div>

      {data.newestTenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No tenants yet"
          blurb="A tenant gets its own database, its own sign-in address and its own administrator. Nothing is shared."
          action={
            <Link to="/platform/tenants/new">
              <PlatformButton>
                <Plus size={15} /> Create the first tenant
              </PlatformButton>
            </Link>
          }
          testId="platform-overview-empty"
        />
      ) : (
        <DataTable
          testId="platform-overview-recent"
          head={
            <>
              <Th>Tenant</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th />
            </>
          }
        >
          {data.newestTenants.map((t) => (
            <tr key={t.slug} className="hover:bg-canvas" data-testid={`overview-tenant-${t.slug}`}>
              <Td>
                <span className="font-semibold">{t.name}</span>
                <span className="block text-[11px] text-muted font-mono">/t/{t.slug}</span>
              </Td>
              <Td>
                <Pill tone={LIFECYCLE_TONE[t.lifecycle] ?? 'quiet'}>
                  <StatusDot
                    state={t.lifecycle === 'ACTIVE' ? 'good' : t.lifecycle === 'PROVISIONING' ? 'warn' : 'bad'}
                    label={t.lifecycle.toLowerCase()}
                  />
                </Pill>
              </Td>
              <Td className="text-muted whitespace-nowrap">{when(t.createdAt)}</Td>
              <Td className="text-end">
                <Link
                  to={`/platform/tenants/${t.slug}`}
                  className="text-[13px] text-brand hover:text-brand"
                  data-testid={`overview-open-${t.slug}`}
                >
                  Open
                </Link>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}
