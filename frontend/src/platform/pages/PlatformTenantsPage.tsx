import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, Search } from 'lucide-react'

import { platformApi, type PlatformTenant, type TenantEstateRow } from '../platformApi'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pill,
  PlatformButton,
  Skeleton,
  StatusDot,
  Td,
  Th,
  bytes,
  when,
} from '../components'

/**
 * Every company on the platform, and enough about each to decide whether it needs attention.
 *
 * A table rather than a wall of cards. Three oversized tiles in an ocean of empty space stop
 * being usable at about six tenants and were never dense enough to compare two — which is what
 * this screen is for.
 */

const LIFECYCLE_TONE: Record<string, 'live' | 'warn' | 'bad' | 'quiet'> = {
  ACTIVE: 'live',
  PROVISIONING: 'warn',
  SUSPENDED: 'bad',
  FAILED: 'bad',
  ARCHIVED: 'quiet',
}

const FILTERS = ['ALL', 'ACTIVE', 'PROVISIONING', 'SUSPENDED', 'FAILED'] as const

export function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<PlatformTenant[] | null>(null)
  const [estate, setEstate] = useState<Record<string, TenantEstateRow>>({})
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')

  const load = useCallback(() => {
    setError('')
    platformApi
      .tenants()
      .then(setTenants)
      .catch((e) => setError(e instanceof Error ? e.message : 'The tenant list could not be loaded.'))

    /*
     * Database health arrives separately and the table renders without it.
     *
     * Pinging every tenant database is the slowest thing on this screen, and making the list
     * of companies wait for it would mean a blank page whenever one of them is down — the
     * exact moment somebody most needs to see the list.
     */
    platformApi
      .reports()
      .then((r) => setEstate(Object.fromEntries(r.estate.map((e) => [e.slug, e]))))
      .catch(() => setEstate({}))
  }, [])

  useEffect(load, [load])

  const shown = useMemo(() => {
    if (!tenants) return []
    const needle = search.trim().toLowerCase()
    return tenants
      .filter((t) => (filter === 'ALL' ? true : t.lifecycle === filter))
      .filter((t) =>
        !needle
          ? true
          : [t.name, t.nameAr, t.slug, t.dbName, t.invoice?.legalName, ...(t.capabilities ?? [])]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)),
      )
  }, [tenants, search, filter])

  if (error) return <ErrorState message={error} onRetry={load} testId="platform-tenants-error" />

  return (
    <div data-testid="platform-tenants-page">
      <PageHeader
        title="Tenants"
        blurb="Each one holds its own database, its own sign-in address and its own administrators. Nothing is shared between them."
        actions={
          <Link to="/platform/tenants/new">
            <PlatformButton testId="platform-new-tenant">
              <Plus size={15} /> New tenant
            </PlatformButton>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, handle, database, legal name or capability"
            data-testid="tenant-search"
            className="w-full h-10 ps-9 pe-3 rounded-xl bg-canvas border border-line text-[13px] placeholder:text-muted outline-none focus:border-brand"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-canvas border border-line p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`tenant-filter-${f.toLowerCase()}`}
              aria-pressed={filter === f}
              className={
                filter === f
                  ? 'h-8 px-3 rounded-lg bg-brand text-brand-fg text-[12px] font-bold'
                  : 'h-8 px-3 rounded-lg text-muted hover:text-ink text-[12px] font-semibold'
              }
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {!tenants ? (
        <Skeleton rows={4} testId="platform-tenants-loading" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={tenants.length === 0 ? 'No tenants yet' : 'Nothing matches that'}
          blurb={
            tenants.length === 0
              ? 'A tenant gets its own database and its own sign-in address the moment it is created.'
              : 'Try a different search, or clear the status filter.'
          }
          action={
            tenants.length === 0 ? (
              <Link to="/platform/tenants/new">
                <PlatformButton>
                  <Plus size={15} /> Create the first tenant
                </PlatformButton>
              </Link>
            ) : (
              <PlatformButton
                variant="ghost"
                onClick={() => {
                  setSearch('')
                  setFilter('ALL')
                }}
                testId="tenant-clear-filters"
              >
                Clear filters
              </PlatformButton>
            )
          }
          testId="platform-tenants-empty"
        />
      ) : (
        <DataTable
          testId="platform-tenants-table"
          head={
            <>
              <Th>Tenant</Th>
              <Th>Status</Th>
              <Th>Database</Th>
              <Th>Capabilities</Th>
              <Th>Provisioning</Th>
              <Th>Created</Th>
              <Th />
            </>
          }
        >
          {shown.map((t) => {
            const health = estate[t.slug]
            const caps = t.capabilities ?? []
            return (
              <tr key={t.id} className="hover:bg-canvas" data-testid={`platform-tenant-${t.slug}`}>
                <Td>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden"
                      style={{ backgroundColor: t.branding?.primaryColor || '#1e293b' }}
                    >
                      {t.branding?.logoUrl ? (
                        <img src={t.branding.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                      ) : (
                        (t.branding?.logoText || t.name).slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{t.name}</span>
                      <span className="block text-[11px] text-muted font-mono truncate">/t/{t.slug}</span>
                    </span>
                  </div>
                </Td>

                <Td>
                  <Pill tone={LIFECYCLE_TONE[t.lifecycle] ?? 'quiet'} testId={`tenant-lifecycle-${t.slug}`}>
                    {t.lifecycle.toLowerCase()}
                  </Pill>
                </Td>

                <Td>
                  <span className="font-mono text-[11px] text-muted block truncate max-w-[190px]">{t.dbName}</span>
                  {health ? (
                    <span className="text-[11px] text-muted">
                      <StatusDot
                        state={health.reachable ? 'good' : 'bad'}
                        label={
                          health.reachable
                            ? [bytes(health.storageBytes), health.users !== null ? `${health.users} users` : null]
                                .filter(Boolean)
                                .join(' · ') || 'answering'
                            : 'not answering'
                        }
                      />
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">checking…</span>
                  )}
                </Td>

                <Td>
                  {caps.length === 0 ? (
                    <span className="text-[11px] text-muted">none yet</span>
                  ) : (
                    <span className="flex flex-wrap gap-1 max-w-[220px]">
                      {caps.slice(0, 3).map((c) => (
                        <span key={c} className="rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-semibold">
                          {c}
                        </span>
                      ))}
                      {caps.length > 3 && (
                        <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                          +{caps.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </Td>

                <Td>
                  {t.provisioning.done === t.provisioning.total ? (
                    <StatusDot state="good" label="complete" />
                  ) : (
                    <StatusDot
                      state={t.provisioning.lastError ? 'bad' : 'warn'}
                      label={`${t.provisioning.done}/${t.provisioning.total}`}
                    />
                  )}
                </Td>

                <Td className="text-muted whitespace-nowrap text-[12px]">{when(t.createdAt)}</Td>

                <Td className="text-end whitespace-nowrap">
                  <Link
                    to={`/platform/tenants/${t.slug}`}
                    className="text-[13px] text-brand hover:text-brand font-medium"
                    data-testid={`platform-open-${t.slug}`}
                  >
                    Manage
                  </Link>
                </Td>
              </tr>
            )
          })}
        </DataTable>
      )}

      {tenants && shown.length > 0 && (
        <p className="text-[12px] text-muted mt-3">
          {shown.length} of {tenants.length} {tenants.length === 1 ? 'tenant' : 'tenants'}
        </p>
      )}
    </div>
  )
}
