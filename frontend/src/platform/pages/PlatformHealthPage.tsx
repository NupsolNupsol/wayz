import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Clock, Cpu, Database, RefreshCw, Server } from 'lucide-react'

import { platformApi, type HealthReport } from '../platformApi'
import {
  DataTable,
  ErrorState,
  PageHeader,
  Pill,
  PlatformButton,
  Skeleton,
  StatCard,
  StatusDot,
  Td,
  Th,
  when,
} from '../components'

/**
 * Is everything the platform depends on actually up?
 *
 * Checked live each time this page is opened, by pinging the things themselves rather than
 * reading a cached status somebody wrote down earlier. Nothing here names a connection string,
 * a credential or a host: an operator needs to know *which* database is down, and the name of
 * a database is not a secret in the way a URI with a password in it is.
 */

function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function PlatformHealthPage() {
  const [data, setData] = useState<HealthReport | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const load = useCallback(() => {
    setChecking(true)
    setError('')
    platformApi
      .health()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'The health check could not be run.'))
      .finally(() => setChecking(false))
  }, [])

  useEffect(load, [load])

  if (error) return <ErrorState message={error} onRetry={load} testId="platform-health-error" />
  if (!data) return <Skeleton rows={4} testId="platform-health-loading" />

  const down = data.tenantDatabases.filter((t) => t.status === 'DOWN')
  const everythingUp = data.controlPlane.status === 'UP' && down.length === 0 && data.provisioning.failed.length === 0

  return (
    <div data-testid="platform-health">
      <PageHeader
        title="System health"
        blurb="Checked live, by asking each service directly. No connection details or credentials are shown here."
        actions={
          <PlatformButton variant="ghost" onClick={load} busy={checking} testId="platform-health-refresh">
            <RefreshCw size={15} /> Check again
          </PlatformButton>
        }
      />

      <div
        className={
          everythingUp
            ? 'rounded-2xl border border-success/25 bg-success/[0.08] p-4 mb-5 flex items-center gap-3'
            : 'rounded-2xl border border-danger-strong/25 bg-danger-strong/[0.07] p-4 mb-5 flex items-center gap-3'
        }
        data-testid="platform-health-summary"
      >
        <span
          className={
            everythingUp
              ? 'w-9 h-9 rounded-xl bg-success/12 text-success flex items-center justify-center shrink-0'
              : 'w-9 h-9 rounded-xl bg-danger-strong/12 text-danger-strong flex items-center justify-center shrink-0'
          }
        >
          <Activity size={17} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[14px]">
            {everythingUp ? 'Everything is responding' : 'Something needs attention'}
          </p>
          <p className="text-[12px] text-muted">
            Checked {when(data.checkedAt)}
            {!everythingUp &&
              ` · ${[
                data.controlPlane.status === 'DOWN' && 'control plane down',
                down.length > 0 && `${down.length} tenant ${down.length === 1 ? 'database' : 'databases'} down`,
                data.provisioning.failed.length > 0 && `${data.provisioning.failed.length} provisioning failed`,
              ]
                .filter(Boolean)
                .join(' · ')}`}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="API" value={data.api.status} hint={`Version ${data.api.version}`} icon={Server} tone="good" testId="health-api" />
        <StatCard
          label="Uptime"
          value={duration(data.api.uptimeSeconds)}
          hint={`Started ${when(data.api.startedAt)}`}
          icon={Clock}
          tone="quiet"
          testId="health-uptime"
        />
        <StatCard
          label="Control plane"
          value={data.controlPlane.status}
          unit={data.controlPlane.latencyMs !== null ? `· ${data.controlPlane.latencyMs} ms` : undefined}
          hint={data.controlPlane.database}
          icon={Database}
          tone={data.controlPlane.status === 'UP' ? 'good' : 'bad'}
          testId="health-control-plane"
        />
        <StatCard
          label="Environment"
          value={data.api.mode}
          hint={`NODE_ENV ${data.api.nodeEnv}`}
          icon={Cpu}
          tone={data.api.mode === 'live' ? 'good' : 'warn'}
          testId="health-mode"
        />
      </div>

      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-3">Tenant databases</h2>
      <DataTable
        testId="health-tenant-databases"
        head={
          <>
            <Th>Tenant</Th>
            <Th>Database</Th>
            <Th>Status</Th>
            <Th>Round trip</Th>
          </>
        }
      >
        {data.tenantDatabases.map((t) => (
          <tr key={t.slug} className="hover:bg-canvas" data-testid={`health-db-${t.slug}`}>
            <Td className="font-semibold">{t.slug}</Td>
            <Td className="font-mono text-[11px] text-muted">{t.dbName}</Td>
            <Td>
              <Pill tone={t.status === 'UP' ? 'live' : 'bad'}>
                <StatusDot state={t.status === 'UP' ? 'good' : 'bad'} label={t.status.toLowerCase()} />
              </Pill>
            </Td>
            <Td className="tabular-nums text-muted">{t.latencyMs === null ? '—' : `${t.latencyMs} ms`}</Td>
          </tr>
        ))}
      </DataTable>

      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mt-6 mb-3">Provisioning</h2>
      {data.provisioning.failed.length === 0 ? (
        <div
          className="rounded-2xl border border-line bg-canvas p-4 text-[13px] text-muted"
          data-testid="health-provisioning-clear"
        >
          Nothing is stuck. Every tenant finished provisioning.
        </div>
      ) : (
        <DataTable
          testId="health-provisioning-failed"
          head={
            <>
              <Th>Tenant</Th>
              <Th>Last error</Th>
              <Th />
            </>
          }
        >
          {data.provisioning.failed.map((f) => (
            <tr key={f.slug} data-testid={`health-failed-${f.slug}`}>
              <Td className="font-semibold">{f.name}</Td>
              <Td className="text-danger-strong text-[12px]">{f.lastError ?? 'No detail recorded'}</Td>
              <Td className="text-end">
                <Link to={`/platform/tenants/${f.slug}`} className="text-[13px] text-brand hover:text-brand">
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
