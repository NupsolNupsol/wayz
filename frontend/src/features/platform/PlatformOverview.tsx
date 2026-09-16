import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bot, Building2, CalendarRange, Layers, Users } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Badge, Card, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { platformApi, type OrganisationFigures } from '@/api/platform.api'

/**
 * What the platform looks like right now, in one screen.
 *
 * The figures are the sum of each organisation's own — assembled by reading every company
 * separately rather than by one query across the database, so these numbers are the same ones
 * each company sees on its own reporting screens. A platform total that disagreed with the
 * tenant totals underneath it would be worse than showing nothing.
 */
export function PlatformOverview() {
  const report = useQuery({ queryKey: ['platform', 'report'], queryFn: () => platformApi.report() })
  const assistant = useQuery({ queryKey: ['platform', 'assistant'], queryFn: () => platformApi.assistant() })
  const catalogue = useQuery({ queryKey: ['platform', 'catalogue'], queryFn: () => platformApi.catalogue() })

  if (report.isLoading || !report.data) {
    return (
      <div data-testid="platform-overview">
        <PageHeader title="Platform" subtitle="Loading…" />
        <Spinner />
      </div>
    )
  }

  const { totals, organisations, adoption } = report.data
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const since = new Date(report.data.from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  return (
    <div data-testid="platform-overview">
      <PageHeader title="Platform" subtitle={`Every organisation on this deployment · since ${since}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Organisations"
          value={totals.organisations}
          icon={<Building2 size={16} />}
          testId="stat-organisations"
        />
        <StatCard label="People" value={totals.staff} icon={<Users size={16} />} testId="stat-staff" />
        <StatCard
          label="Activities coded"
          value={catalogue.data?.activities.length ?? '—'}
          icon={<Layers size={16} />}
          testId="stat-activities"
          sublabel="available to adopt"
        />
        <StatCard
          label="Bookings"
          value={totals.bookings}
          icon={<CalendarRange size={16} />}
          testId="stat-bookings"
          sublabel="in this window"
        />
        <StatCard
          label="Revenue"
          value={money(totals.revenue)}
          tone={totals.revenue > 0 ? 'success' : 'neutral'}
          testId="stat-revenue"
          sublabel="paid, in this window"
        />
      </div>

      {/*
        The assistant's reachability, stated plainly.

        It is a separate service and it can be switched off, so a console that simply showed
        empty knowledge lists would be lying by omission about why.
      */}
      <Card className="mt-4 flex items-center gap-3 p-4" data-testid="assistant-health">
        <Bot size={18} className="text-muted" />
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-navy dark:text-dk-texthi">Learning assistant</div>
          <div className="text-[12px] text-muted">
            {assistant.data?.reachable
              ? 'Reachable. Documents uploaded here are indexed for retrieval.'
              : assistant.data?.status === 'not-configured'
                ? 'Not configured on this server — set AI_SERVICE_URL and AI_SERVICE_SECRET to enable it.'
                : 'Not answering at the moment. Uploads will fail until it is back.'}
          </div>
        </div>
        <Badge tone={assistant.data?.reachable ? 'success' : 'warning'}>
          {assistant.data?.reachable ? 'Online' : (assistant.data?.status ?? 'Unknown')}
        </Badge>
      </Card>

      <SectionTitle className="mt-6">Organisations</SectionTitle>
      <Card className="p-0">
        <DataTable<OrganisationFigures>
          testId="platform-organisations"
          rows={organisations}
          keyOf={(o) => o.id}
          empty={{ title: 'No organisations yet.', message: 'Create the first one to get started.' }}
          columns={[
            {
              key: 'name',
              header: 'Organisation',
              sortValue: (o) => o.name,
              render: (o) => (
                <Link to="/platform/organisations" className="font-medium text-brand no-underline">
                  {o.name}
                </Link>
              ),
            },
            { key: 'activities', header: 'Activities', align: 'right', sortValue: (o) => o.activities.length, render: (o) => o.activities.length },
            { key: 'staff', header: 'People', align: 'right', sortValue: (o) => o.staff, render: (o) => o.staff },
            { key: 'sites', header: 'Locations', align: 'right', sortValue: (o) => o.sites, render: (o) => o.sites },
            { key: 'resources', header: 'Resources', align: 'right', sortValue: (o) => o.resources, render: (o) => o.resources },
            { key: 'bookings', header: 'Bookings', align: 'right', sortValue: (o) => o.bookings, render: (o) => o.bookings },
            { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (o) => o.revenue, render: (o) => money(o.revenue) },
          ]}
        />
      </Card>

      {/*
        Adoption is the platform-level question the tenant screens cannot answer: not "how is
        this company doing" but "which of the things we built is anybody actually running".
      */}
      <SectionTitle className="mt-6">Activity adoption</SectionTitle>
      <Card className="p-0">
        <DataTable
          testId="platform-adoption"
          rows={adoption}
          keyOf={(a) => a.kind}
          pageSize={20}
          empty={{ title: 'No activities registered.' }}
          columns={[
            { key: 'activity', header: 'Activity', sortValue: (a) => a.label.en, render: (a) => a.label.en },
            {
              key: 'adopted',
              header: 'Adopted by',
              align: 'right',
              sortValue: (a) => a.organisations,
              render: (a) => (
                <span className={a.organisations === 0 ? 'text-muted' : ''}>
                  {a.organisations === 0 ? 'nobody' : `${a.organisations} of ${totals.organisations}`}
                </span>
              ),
            },
            { key: 'bookings', header: 'Bookings', align: 'right', sortValue: (a) => a.bookings, render: (a) => a.bookings },
            { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (a) => a.revenue, render: (a) => money(a.revenue) },
          ]}
        />
      </Card>
    </div>
  )
}
