import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScrollText, Search } from 'lucide-react'

import { platformApi, type PlatformAuditRow, type PlatformTenant } from '../platformApi'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  PlatformButton,
  Skeleton,
  Td,
  Th,
  when,
} from '../components'

/**
 * Who did what, to which tenant, and when.
 *
 * Searchable the way somebody investigating actually searches: they know one thing — a
 * person, a company, a date, half of an action's name — and not which of those it is. So the
 * free-text box matches across all of them, and the filters narrow rather than replace it.
 */

const SINCE = [
  { label: 'Any time', value: '' },
  { label: 'Last 24 hours', value: '1' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
] as const

export function PlatformAuditPage() {
  const [rows, setRows] = useState<PlatformAuditRow[] | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [tenants, setTenants] = useState<PlatformTenant[]>([])
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [days, setDays] = useState('')

  const since = useMemo(
    () => (days ? new Date(Date.now() - Number(days) * 86_400_000).toISOString() : undefined),
    [days],
  )

  const load = useCallback(() => {
    setError('')
    platformApi
      .audit({ q: q || undefined, action: action || undefined, tenantId: tenantId || undefined, since })
      .then((r) => {
        setRows(r.rows)
        setTotal(r.total)
        setActions(r.actions)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'The audit log could not be loaded.'))
  }, [q, action, tenantId, since])

  useEffect(() => {
    platformApi.tenants().then(setTenants).catch(() => setTenants([]))
  }, [])

  // Debounced, so typing in the search box is not one request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(load, 250)
    return () => window.clearTimeout(t)
  }, [load])

  const filtering = !!(q || action || tenantId || days)

  const select =
    'h-10 px-3 rounded-xl bg-canvas border border-line text-[13px] text-ink outline-none focus:border-brand [&>option]:bg-surface'

  if (error) return <ErrorState message={error} onRetry={load} testId="platform-audit-error" />

  return (
    <div data-testid="platform-audit">
      <PageHeader
        title="Audit log"
        blurb="Every action taken in the control plane, recorded as it happened. Entries are written, never edited."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action, tenant or description"
            data-testid="audit-search"
            className="w-full h-10 ps-9 pe-3 rounded-xl bg-canvas border border-line text-[13px] placeholder:text-muted outline-none focus:border-brand"
          />
        </div>

        <select value={action} onChange={(e) => setAction(e.target.value)} className={select} data-testid="audit-action">
          <option value="">Any action</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className={select} data-testid="audit-tenant">
          <option value="">Any tenant</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select value={days} onChange={(e) => setDays(e.target.value)} className={select} data-testid="audit-since">
          {SINCE.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {filtering && (
          <PlatformButton
            variant="ghost"
            testId="audit-clear"
            onClick={() => {
              setQ('')
              setAction('')
              setTenantId('')
              setDays('')
            }}
          >
            Clear
          </PlatformButton>
        )}
      </div>

      {!rows ? (
        <Skeleton rows={6} testId="platform-audit-loading" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtering ? 'Nothing matches those filters' : 'Nothing recorded yet'}
          blurb={
            filtering
              ? 'Try a wider date range, or clear the filters.'
              : 'Actions taken in the control plane will appear here as they happen.'
          }
          testId="platform-audit-empty"
        />
      ) : (
        <>
          <DataTable
            testId="platform-audit-table"
            head={
              <>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Tenant</Th>
                <Th>What changed</Th>
              </>
            }
          >
            {rows.map((r) => (
              <tr key={r._id} className="hover:bg-canvas" data-testid="audit-row">
                <Td className="whitespace-nowrap text-muted text-[12px]">{when(r.at)}</Td>
                <Td className="text-ink">{r.actorEmail || r.actorId}</Td>
                <Td>
                  <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-semibold font-mono">
                    {r.action}
                  </span>
                </Td>
                <Td>
                  {r.tenantId ? (
                    <Link to={`/platform/tenants/${r.tenantId}`} className="text-brand hover:text-brand">
                      {r.tenantId}
                    </Link>
                  ) : (
                    <span className="text-muted">platform</span>
                  )}
                </Td>
                <Td className="text-muted min-w-[220px] max-w-[380px] whitespace-normal">{r.detail || '—'}</Td>
              </tr>
            ))}
          </DataTable>

          <p className="text-[12px] text-muted mt-3">
            Showing {rows.length} of {total} {total === 1 ? 'entry' : 'entries'}
            {rows.length < total && ' — narrow the filters to see older ones'}
          </p>
        </>
      )}
    </div>
  )
}
