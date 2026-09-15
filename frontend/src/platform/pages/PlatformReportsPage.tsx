import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Info } from 'lucide-react'

import { platformApi, type PlatformReports } from '../platformApi'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  PlatformCard,
  Skeleton,
  StatusDot,
  Td,
  Th,
  bytes,
  when,
} from '../components'

/**
 * How the platform itself is doing — and nothing about what any tenant sells.
 *
 * The isolation rule is not softened for reporting. Bookings, payments and customers live in
 * the tenant's own database and are never read here, aggregated here, or copied into the
 * control plane. What this page reports is the platform's own estate: how many companies
 * exist, when they arrived, what they are configured to do, how much room they take, and what
 * administrators have been doing.
 *
 * Charts only where there is real data to draw. A growth line through one month is a straight
 * segment that implies a trend nobody measured, so the shape only appears once there are
 * several months of it.
 */

function Bar({ label, value, max, testId }: { label: string; value: number; max: number; testId?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3" data-testid={testId}>
      <span className="w-[132px] shrink-0 text-[12px] text-muted truncate">{label}</span>
      <span className="flex-1 h-2 rounded-full bg-canvas overflow-hidden">
        <span className="block h-full rounded-full bg-brand/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-8 shrink-0 text-end text-[12px] tabular-nums text-ink">{value}</span>
    </div>
  )
}

export function PlatformReportsPage() {
  const [data, setData] = useState<PlatformReports | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    platformApi
      .reports()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'The reports could not be loaded.'))
  }, [])

  useEffect(load, [load])

  if (error) return <ErrorState message={error} onRetry={load} testId="platform-reports-error" />
  if (!data) return <Skeleton rows={4} testId="platform-reports-loading" />

  const capMax = Math.max(1, ...data.capabilityAdoption.map((c) => c.tenants))
  const profMax = Math.max(1, ...data.profileAdoption.map((p) => p.tenants))
  const auditMax = Math.max(1, ...data.auditByAction.map((a) => a.count))
  const growthMax = Math.max(1, ...data.growth.map((g) => g.cumulative))

  return (
    <div data-testid="platform-reports">
      <PageHeader
        title="Reports"
        blurb="The platform's own estate. No tenant's operational data is read or aggregated here."
      />

      <div
        className="rounded-xl border border-brand/20 bg-brand/[0.06] p-3 mb-5 flex items-start gap-2.5 text-[12px] text-ink"
        data-testid="platform-reports-scope"
      >
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          Everything below is measured from the control-plane registry and from each tenant
          database's own report of itself. Bookings, payments and customers stay inside the
          tenant that owns them — the control plane never reads them, and a report that merged
          them would break the isolation the architecture exists for.
        </p>
      </div>

      {data.estate.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing to report yet"
          blurb="Reports appear once there is at least one tenant on the platform."
          testId="platform-reports-empty"
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <PlatformCard testId="report-growth">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-4">
                Tenants over time
              </h2>
              {data.growth.length < 2 ? (
                /*
                 * One data point is not a trend. Rather than draw a line implying one, the
                 * figure is stated and the chart waits until there is a shape to show.
                 */
                <p className="text-[13px] text-muted" data-testid="report-growth-too-early">
                  {data.growth[0]
                    ? `${data.growth[0].cumulative} tenant${data.growth[0].cumulative === 1 ? '' : 's'}, all created in ${data.growth[0].month}. A chart appears once there is more than one month to compare.`
                    : 'No tenants have been created yet.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {data.growth.map((g) => (
                    <Bar
                      key={g.month}
                      label={g.month}
                      value={g.cumulative}
                      max={growthMax}
                      testId={`report-growth-${g.month}`}
                    />
                  ))}
                </div>
              )}
            </PlatformCard>

            <PlatformCard testId="report-audit-actions">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-4">
                What administrators have done
              </h2>
              {data.auditByAction.length === 0 ? (
                <p className="text-[13px] text-muted">Nothing has been recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.auditByAction.map((a) => (
                    <Bar key={a.action} label={a.action} value={a.count} max={auditMax} testId={`report-action-${a.action}`} />
                  ))}
                </div>
              )}
            </PlatformCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <PlatformCard testId="report-capabilities">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-1">
                Capability adoption
              </h2>
              <p className="text-[12px] text-muted mb-4">How many tenants have each capability enabled.</p>
              <div className="space-y-2">
                {data.capabilityAdoption.map((c) => (
                  <Bar key={c.key} label={c.label} value={c.tenants} max={capMax} testId={`report-cap-${c.key}`} />
                ))}
              </div>
            </PlatformCard>

            <PlatformCard testId="report-profiles">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-1">Job adoption</h2>
              <p className="text-[12px] text-muted mb-4">Which jobs tenants have chosen to staff.</p>
              <div className="space-y-2">
                {data.profileAdoption.map((p) => (
                  <Bar key={p.key} label={p.label} value={p.tenants} max={profMax} testId={`report-profile-${p.key}`} />
                ))}
              </div>
            </PlatformCard>
          </div>

          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted mb-3">Estate</h2>
          <DataTable
            testId="report-estate"
            head={
              <>
                <Th>Tenant</Th>
                <Th>Database</Th>
                <Th>Reachable</Th>
                <Th>Stored</Th>
                <Th>Collections</Th>
                <Th>Users</Th>
                <Th>Sites</Th>
                <Th>Stations</Th>
                <Th>Created</Th>
              </>
            }
          >
            {data.estate.map((e) => (
              <tr key={e.slug} className="hover:bg-canvas" data-testid={`report-estate-${e.slug}`}>
                <Td>
                  <Link to={`/platform/tenants/${e.slug}`} className="font-semibold hover:text-brand">
                    {e.name}
                  </Link>
                </Td>
                <Td className="font-mono text-[11px] text-muted">{e.dbName}</Td>
                <Td>
                  <StatusDot state={e.reachable ? 'good' : 'bad'} label={e.reachable ? 'yes' : 'no'} />
                </Td>
                <Td className="tabular-nums text-muted">{bytes(e.storageBytes) ?? '—'}</Td>
                <Td className="tabular-nums text-muted">{e.collections ?? '—'}</Td>
                <Td className="tabular-nums text-muted">{e.users ?? '—'}</Td>
                <Td className="tabular-nums text-muted">{e.sites ?? '—'}</Td>
                <Td className="tabular-nums text-muted">{e.stations ?? '—'}</Td>
                <Td className="text-muted text-[12px] whitespace-nowrap">{when(e.createdAt)}</Td>
              </tr>
            ))}
          </DataTable>
          <p className="text-[11px] text-muted mt-2">
            A dash means the figure could not be read from that database. It is never shown as zero.
          </p>
        </>
      )}
    </div>
  )
}
