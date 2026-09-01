import { useState } from 'react'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { Receipt, User, Package } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle, StatusBadge, Spinner, Badge, EmptyState } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Timer } from '@/components/Timer'
import {
  useManagerCustomer,
  useManagerCustomers,
  useManagerPayments,
  useManagerRental,
  useManagerRentals,
  useManagerActivity,
} from '@/hooks'
import { ENGINE_META, engineLabel } from '@/config/engineMeta'
import { formatDateTime, money } from '@/utils'
import type { EngineKind } from '@/api/types'
import { RefLink, RefText } from '@/components/RefLink'

const SCOPES = [
  { id: 'active', labelKey: 'manager:records.tabActive' },
  { id: 'expired', labelKey: 'manager:records.tabExpired' },
  { id: 'completed', labelKey: 'manager:records.tabCompleted' },
  { id: 'all', labelKey: 'manager:records.tabAll' },
] as const

export function ManagerRentals() {
  const { t } = useTranslation(['manager', 'common'])
  const navigate = useNavigate()
  const [scope, setScope] = useState<(typeof SCOPES)[number]['id']>('active')
  const { data = [], isLoading } = useManagerRentals(scope)

  return (
    <div data-testid="manager-rentals">
      <PageHeader title={t('records.rentals')} subtitle={t('records.rentalsSubtitle')} crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.rentals') }]} />

      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            data-testid={`rentals-tab-${s.id}`}
            className={clsx(
              'lf-chip !px-3 !py-1.5 border transition-colors',
              scope === s.id ? 'border-brand bg-brand/10 text-brand font-semibold' : 'border-line text-muted hover:border-brand',
            )}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : (
        <DataTable
          testId="rentals-table"
          rows={data}
          keyOf={(r) => r._id}
          onRowClick={(r) => navigate(`/manager/rentals/${r._id}`)}
          empty={{ title: t('records.nothingHere'), message: t('records.noMatch') }}
          columns={[
            { key: 'ref', header: t('common:column.reference'), sortValue: (r) => r.ref, filter: { kind: 'text', value: (r) => r.ref }, render: (r) => <RefLink to={`/manager/rentals/${r._id}`}>{r.ref}</RefLink> },
            { key: 'customer', header: t('common:column.customer'), filter: { kind: 'text', value: (r) => r.customerName }, render: (r) => <div><p>{r.customerName || '—'}</p><p className="text-xs text-muted">{r.customerPhone}</p></div> },
            { key: 'service', header: t('common:column.service'), filter: { kind: 'select', options: Object.keys(ENGINE_META).map((e) => ({ label: engineLabel(e as EngineKind), value: e })), value: (r) => r.engineKind }, render: (r) => engineLabel(r.engineKind) },
            { key: 'station', header: t('common:column.station'), filter: { kind: 'text', value: (r) => r.stationName }, render: (r) => <span className="text-muted">{r.stationName}</span> },
            { key: 'agent', header: t('common:column.agent'), render: (r) => <span className="text-muted">{r.agentName}</span> },
            { key: 'status', header: t('common:column.status'), filter: { kind: 'text', value: (r) => r.status }, render: (r) => <StatusBadge status={r.status} /> },
            { key: 'remaining', header: t('common:column.remaining'), align: 'right', sortValue: (r) => r.remainingMs ?? 0, render: (r) => (r.startedAt ? <Timer expectedEndAt={r.expectedEndAt} /> : <span className="text-muted">—</span>) },
            { key: 'penalty', header: t('common:column.penalty'), align: 'right', sortValue: (r) => r.penaltyAmount, render: (r) => (r.penaltyAmount > 0 ? <strong className="text-danger-strong">{money(r.penaltyAmount)}</strong> : <span className="text-muted">—</span>) },
          ]}
        />
      )}
    </div>
  )
}

export function ManagerRentalDetail() {
  const { t } = useTranslation(['manager', 'common'])
  const { id } = useParams()
  const { data, isLoading } = useManagerRental(id)

  if (isLoading) return <Spinner />
  if (!data) return <Card><EmptyState title={t('records.rentalNotFound')} /></Card>

  const b = data.booking as Record<string, unknown> & {
    ref: string
    status: string
    customerName: string
    productName: string
    bags: { index: number; description: string; status: string }[]
    custody: { from: string; to: string; at: string; note?: string }[]
    overtime: { penaltyAmount: number; phase: string; chargeableHours: number }
  }

  return (
    <div data-testid="manager-rental-detail">
      <PageHeader
        title={b.ref}
        subtitle={`${b.productName} · ${data.stationName} · agent ${data.agentName}`}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.rentals'), to: '/manager/rentals' }, { label: b.ref }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>{t('records.session')}</SectionTitle>
              <StatusBadge status={b.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Meta label="Customer" value={b.customerName || '—'} />
              <Meta label={t('records.items')} value={String(b.bags?.length ?? 0)} />
              <Meta label={t('records.phase')} value={b.overtime.phase} />
              <Meta label={t('records.penalty')} value={b.overtime.penaltyAmount > 0 ? money(b.overtime.penaltyAmount) : '—'} />
            </div>
          </Card>

          {data.order && (
            <Card>
              <SectionTitle className="mb-3 flex items-center gap-2"><Receipt size={18} /> Order {data.order.ref}</SectionTitle>
              <table className="w-full text-sm">
                <tbody>
                  {data.order.lines.map((l, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="py-1.5">{l.name}</td>
                      <td className="py-1.5 text-end tabular-nums">{money(l.unitPrice * l.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-between text-sm font-bold">
                <span>{t('common:field.total')}</span>
                <span className="tabular-nums">{money(data.order.total)}</span>
              </div>
              <Badge tone={data.order.status === 'PAID' ? 'success' : 'warning'} className="mt-2">{data.order.status}</Badge>
            </Card>
          )}

          {b.bags?.length > 0 && (
            <Card>
              <SectionTitle className="mb-3 flex items-center gap-2"><Package size={18} />{t('records.items')}</SectionTitle>
              <ul className="flex flex-col gap-1.5">
                {b.bags.map((bag) => (
                  <li key={bag.index} className="flex justify-between rounded-lg bg-canvas dark:bg-dk-elevated px-3 py-2 text-sm">
                    <span>Item {bag.index} · {bag.description}</span>
                    <StatusBadge status={bag.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle className="mb-3">{t('records.payments')}</SectionTitle>
            {data.payments.length === 0 ? <p className="text-sm text-muted">{t('records.noneRecorded')}</p> : (
              <ul className="flex flex-col gap-2">
                {data.payments.map((p) => (
                  <li key={p._id} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{p.method} · {p.kind}</span>
                    <strong className="tabular-nums">{money(p.amount)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle className="mb-3">{t('records.custodyTrail')}</SectionTitle>
            {!b.custody?.length ? <p className="text-sm text-muted">{t('records.noEvents')}</p> : (
              <ol className="relative border-s border-line ms-2">
                {b.custody.map((c, i) => (
                  <li key={i} className="ms-4 pb-3 last:pb-0">
                    <span className="absolute -start-1.5 w-3 h-3 rounded-full bg-brand" />
                    <p className="text-sm font-medium">{c.from} → {c.to}</p>
                    <p className="text-xs text-muted">{c.note} · {formatDateTime(new Date(c.at).getTime())}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export function ManagerCustomers() {
  const { t } = useTranslation(['manager', 'common'])
  const navigate = useNavigate()
  const { data = [], isLoading } = useManagerCustomers()
  return (
    <div data-testid="manager-customers">
      <PageHeader title={t('records.customers')} subtitle={t('records.customersSubtitle')} crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.customers') }]} />
      {isLoading ? <Spinner /> : (
        <DataTable
          testId="customers-table"
          rows={data}
          keyOf={(r) => r._id}
          onRowClick={(r) => navigate(`/manager/customers/${r._id}`)}
          empty={{ title: t('records.noCustomers'), message: t('records.customersHint') }}
          columns={[
            { key: 'name', header: t('common:column.name'), sortValue: (r) => r.name, filter: { kind: 'text', value: (r) => `${r.name} ${r.phone}` }, render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: 'phone', header: t('common:column.phone'), render: (r) => <span className="text-muted">{r.phone}</span> },
            { key: 'email', header: t('common:column.email'), render: (r) => <span className="text-muted">{r.email || '—'}</span> },
            { key: 'bookings', header: t('common:column.bookings'), align: 'right', sortValue: (r) => r.bookings, render: (r) => <span className="tabular-nums">{r.bookings}</span> },
            { key: 'completed', header: t('common:column.completed'), align: 'right', render: (r) => <span className="tabular-nums text-muted">{r.completed}</span> },
            { key: 'last', header: t('common:column.lastseen'), align: 'right', sortValue: (r) => (r.lastBookingAt ? new Date(r.lastBookingAt).getTime() : 0), render: (r) => <span className="text-muted text-xs">{r.lastBookingAt ? formatDateTime(new Date(r.lastBookingAt).getTime()) : '—'}</span> },
          ]}
        />
      )}
    </div>
  )
}

export function ManagerCustomerDetail() {
  const { t } = useTranslation(['manager', 'common'])
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useManagerCustomer(id)

  if (isLoading) return <Spinner />
  if (!data) return <Card><EmptyState title={t('records.customerNotFound')} /></Card>

  return (
    <div data-testid="manager-customer-detail">
      <PageHeader
        title={data.customer.name}
        subtitle={`${data.customer.phone}${data.customer.email ? ` · ${data.customer.email}` : ''}`}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.customers'), to: '/manager/customers' }, { label: data.customer.name }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card><p className="text-xs uppercase tracking-wide text-muted">{t('records.lifetimeValue')}</p><p className="text-2xl font-bold text-success mt-1">{money(data.lifetimeValue)}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-muted">{t('records.bookingsCount')}</p><p className="text-2xl font-bold mt-1">{data.bookings.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-muted">{t('records.since')}</p><p className="text-sm font-semibold mt-2">{formatDateTime(new Date(data.customer.createdAt).getTime())}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-muted">{t('records.contact')}</p><p className="text-sm font-semibold mt-2 flex items-center gap-1"><User size={14} /> {data.customer.phone}</p></Card>
      </div>

      <Card>
        <SectionTitle className="mb-3">{t('records.rentalHistory')}</SectionTitle>
        <DataTable
          testId="customer-history-table"
          rows={data.bookings}
          keyOf={(r) => r._id}
          onRowClick={(r) => navigate(`/manager/rentals/${r._id}`)}
          empty={{ title: t('records.noRentals') }}
          columns={[
            { key: 'ref', header: t('common:column.reference'), sortValue: (r) => r.ref, render: (r) => <RefLink to={`/manager/rentals/${r._id}`}>{r.ref}</RefLink> },
            { key: 'service', header: t('common:column.service'), render: (r) => engineLabel(r.engineKind) },
            { key: 'product', header: t('common:column.product'), render: (r) => <span className="text-muted">{r.productName}</span> },
            { key: 'status', header: t('common:column.status'), render: (r) => <StatusBadge status={r.status} /> },
            { key: 'penalty', header: t('common:column.penalty'), align: 'right', render: (r) => (r.penaltyAmount > 0 ? money(r.penaltyAmount) : '—') },
            { key: 'when', header: t('common:column.date'), align: 'right', sortValue: (r) => new Date(r.createdAt).getTime(), render: (r) => <span className="text-muted text-xs">{formatDateTime(new Date(r.createdAt).getTime())}</span> },
          ]}
        />
      </Card>
    </div>
  )
}

export function ManagerPayments() {
  const { t } = useTranslation(['manager', 'common'])
  const statusLabel = useStatusLabel()
  const { data = [], isLoading } = useManagerPayments()
  const refunds = data.filter((p) => p.kind === 'REFUND')

  return (
    <div data-testid="manager-payments">
      <PageHeader title={t('records.payments')} subtitle={t('records.paymentsSubtitle')} crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.payments') }]} />

      {refunds.length > 0 && (
        <Card className="mb-5 border-amber-400/60 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t('records.refundsRecorded', { count: refunds.length })}</p>
        </Card>
      )}

      {isLoading ? <Spinner /> : (
        <DataTable
          testId="payments-table"
          rows={data}
          keyOf={(r) => r._id}
          empty={{ title: t('records.noPayments'), message: t('records.paymentsHint') }}
          columns={[
            { key: 'id', header: t('common:column.payment'), sortValue: (r) => r._id, filter: { kind: 'text', value: (r) => r._id }, render: (r) => <RefText>{r._id}</RefText> },
            {
              key: 'booking',
              header: t('common:column.booking'),
              filter: { kind: 'text', value: (r) => r.bookingRef ?? '' },
              render: (r) =>
                r.bookingId && r.bookingRef ? (
                  <RefLink to={`/manager/rentals/${r.bookingId}`}>{r.bookingRef}</RefLink>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            { key: 'customer', header: t('common:column.customer'), render: (r) => r.customerName ?? '—' },
            { key: 'method', header: t('common:column.method'), filter: { kind: 'select', options: [...new Set(data.map((p) => p.method))].map((m) => ({ label: m, value: m })), value: (r) => r.method }, render: (r) => <Badge tone="neutral">{statusLabel(r.method, 'method')}</Badge> },
            { key: 'kind', header: t('common:column.kind'), filter: { kind: 'select', options: [...new Set(data.map((p) => p.kind))].map((k) => ({ label: statusLabel(k, 'paymentKind'), value: k })), value: (r) => r.kind }, render: (r) => <Badge tone={r.kind === 'REFUND' ? 'warning' : 'info'}>{statusLabel(r.kind, 'paymentKind')}</Badge> },
            { key: 'station', header: t('common:column.station'), render: (r) => <span className="text-muted">{r.stationName}</span> },
            { key: 'amount', header: t('common:column.amount'), align: 'right', sortValue: (r) => r.amount, render: (r) => <strong className="tabular-nums">{money(r.amount)}</strong> },
            { key: 'when', header: t('common:column.date'), align: 'right', sortValue: (r) => new Date(r.createdAt).getTime(), render: (r) => <span className="text-muted text-xs">{formatDateTime(new Date(r.createdAt).getTime())}</span> },
          ]}
        />
      )}
    </div>
  )
}

export function ManagerActivity() {
  const { t } = useTranslation(['manager', 'common'])
  const { data = [], isLoading } = useManagerActivity()
  return (
    <div data-testid="manager-activity">
      <PageHeader
        title={t('records.activity')}
        subtitle={t('records.activitySubtitle')}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('records.activity') }]}
      />
      {isLoading ? <Spinner /> : (
        <DataTable
          testId="activity-table"
          rows={data}
          keyOf={(r) => r._id}
          empty={{ title: t('records.noActivity'), message: t('records.activityHint') }}
          columns={[
            { key: 'when', header: t('common:column.when'), sortValue: (r) => new Date(r.at).getTime(), render: (r) => <span className="text-muted text-xs">{formatDateTime(new Date(r.at).getTime())}</span> },
            { key: 'action', header: t('common:column.action'), filter: { kind: 'text', value: (r) => r.action }, render: (r) => <RefText>{t(`status:auditAction.${r.action}`, { defaultValue: r.action.replaceAll('_', ' ').toLowerCase() })}</RefText> },
            { key: 'entity', header: t('common:column.entity'), filter: { kind: 'select', options: [...new Set(data.map((r) => r.entity))].map((e) => ({ label: t(`status:entity.${e}`, { defaultValue: e }), value: e })), value: (r) => r.entity }, render: (r) => <span className="text-muted">{t(`status:entity.${r.entity}`, { defaultValue: r.entity })}</span> },
            { key: 'reference', header: t('common:column.reference'), filter: { kind: 'text', value: (r) => r.entityId }, render: (r) => <RefText>{r.entityId}</RefText> },
            { key: 'actor', header: t('common:column.by'), filter: { kind: 'text', value: (r) => r.actorId }, render: (r) => <span className="text-muted">{r.actorId}</span> },
            { key: 'detail', header: t('common:column.detail'), render: (r) => <span className="text-muted line-clamp-1">{r.detail ?? '—'}</span> },
            { key: 'reason', header: t('common:column.reason'), render: (r) => (r.reason ? <span className="text-amber-700 dark:text-amber-300 line-clamp-1">{r.reason}</span> : <span className="text-muted">—</span>) },
          ]}
        />
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted">{label}</p><p className="font-semibold text-navy dark:text-dk-text">{value}</p></div>
}
