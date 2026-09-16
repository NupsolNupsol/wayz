import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/PageHeader'
import { Card, Field, SectionTitle, Spinner } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { platformApi, type OrganisationFigures } from '@/api/platform.api'

/**
 * Reporting across the companies, for a window somebody chooses.
 *
 * ## Where these numbers come from
 *
 * Each organisation is read inside its own scope and the results are added up here. That is
 * slower than one aggregate over the whole database and it is the point: the figures a
 * platform administrator sees are produced by the same scoping that produces the figures the
 * company itself sees, so the two can never quietly disagree.
 *
 * The per-activity breakdown is the question this screen exists for. A tenant admin can
 * already see how their own activities are doing; only from here can you ask whether horse
 * riding earns more at one company than another, or whether an activity nobody adopted is
 * worth keeping.
 */
export function PlatformReports() {
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)

  const report = useQuery({
    queryKey: ['platform', 'report', from, to],
    queryFn: () => platformApi.report({ from, to: `${to}T23:59:59.999Z` }),
  })

  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div data-testid="platform-reports">
      <PageHeader title="Reports" subtitle="Every organisation, over a window you choose" />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="From" className="w-[170px]">
          <input
            type="date"
            className="lf-input"
            data-testid="report-from"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To" className="w-[170px]">
          <input
            type="date"
            className="lf-input"
            data-testid="report-to"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        {report.isFetching && <Spinner label="Reading each organisation…" />}
      </Card>

      {!report.data ? (
        <Spinner />
      ) : (
        <>
          <SectionTitle>By organisation</SectionTitle>
          <Card className="p-0">
            <DataTable<OrganisationFigures>
              testId="report-organisations"
              rows={report.data.organisations}
              keyOf={(o) => o.id}
              pageSize={25}
              empty={{ title: 'No organisations.' }}
              columns={[
                { key: 'name', header: 'Organisation', sortValue: (o) => o.name, render: (o) => o.name },
                { key: 'staff', header: 'People', align: 'right', sortValue: (o) => o.staff, render: (o) => o.staff },
                { key: 'sites', header: 'Locations', align: 'right', sortValue: (o) => o.sites, render: (o) => o.sites },
                { key: 'stations', header: 'Areas', align: 'right', sortValue: (o) => o.stations, render: (o) => o.stations },
                { key: 'resources', header: 'Resources', align: 'right', sortValue: (o) => o.resources, render: (o) => o.resources },
                { key: 'bookings', header: 'Bookings', align: 'right', sortValue: (o) => o.bookings, render: (o) => o.bookings },
                { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (o) => o.revenue, render: (o) => money(o.revenue) },
              ]}
              /* One cell per column, in column order — the table draws the row itself. */
              footer={(rows) => [
                'Total',
                rows.reduce((n, o) => n + o.staff, 0),
                rows.reduce((n, o) => n + o.sites, 0),
                rows.reduce((n, o) => n + o.stations, 0),
                rows.reduce((n, o) => n + o.resources, 0),
                rows.reduce((n, o) => n + o.bookings, 0),
                <span data-testid="report-total-revenue">{money(rows.reduce((n, o) => n + o.revenue, 0))}</span>,
              ]}
            />
          </Card>

          <SectionTitle className="mt-6">By activity, across the platform</SectionTitle>
          <Card className="p-0">
            <DataTable
              testId="report-adoption"
              rows={report.data.adoption}
              keyOf={(a) => a.kind}
              pageSize={20}
              empty={{ title: 'No activities registered.' }}
              columns={[
                { key: 'activity', header: 'Activity', sortValue: (a) => a.label.en, render: (a) => a.label.en },
                {
                  key: 'orgs',
                  header: 'Organisations running it',
                  align: 'right',
                  sortValue: (a) => a.organisations,
                  render: (a) => a.organisations,
                },
                { key: 'bookings', header: 'Bookings', align: 'right', sortValue: (a) => a.bookings, render: (a) => a.bookings },
                { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (a) => a.revenue, render: (a) => money(a.revenue) },
              ]}
            />
          </Card>

          {/*
            Each company's own split, one block each. Shown rather than folded into the table
            above because the useful comparison is within a company, not across a column.
          */}
          <SectionTitle className="mt-6">Each organisation's activities</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {report.data.organisations.map((org) => (
              <Card key={org.id} className="p-4" data-testid={`report-org-${org.id}`}>
                <div className="mb-2 text-[13.5px] font-semibold text-navy dark:text-dk-texthi">{org.name}</div>
                {org.byActivity.length === 0 ? (
                  <p className="text-[12px] text-muted">No activities adopted.</p>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <tbody>
                      {org.byActivity.map((line) => (
                        <tr key={line.kind} className="border-t border-line first:border-0 dark:border-dk-line">
                          <td className="py-1.5">{line.kind.replace(/_/g, ' ').toLowerCase()}</td>
                          <td className="py-1.5 text-right text-muted">{line.bookings} bookings</td>
                          <td className="py-1.5 text-right font-medium">{money(line.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
