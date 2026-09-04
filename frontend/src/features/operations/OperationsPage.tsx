import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge, Button, Spinner, Badge } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'
import { Timer } from '@/components/Timer'
import { Icon } from '@/components/Icon'
import { LiveIndicator } from '@/components/LiveIndicator'
import { useBookings, useUnits } from '@/hooks'
import { ENGINE_META, engineLabel, engineOptionsFor } from '@/config/engineMeta'
import type { Booking } from '@/api/types'
import { RefLink } from '@/components/RefLink'
import { useAuthStore } from '@/store/auth'
import { formatDateTime, money, sinceLabel } from '@/utils'

const ACTIVE = ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS', 'PREPARING', 'CONFIRMED', 'RESERVED']
const STATUS_OPTS = ACTIVE.map((s) => ({ label: s.replaceAll('_', ' '), value: s }))
const endMs = (b: Booking) => (b.session.expectedEndAt ? new Date(b.session.expectedEndAt).getTime() : Number.MAX_SAFE_INTEGER)
const startedMs = (b: Booking) => (b.session.startedAt ? new Date(b.session.startedAt).getTime() : new Date(b.createdAt).getTime())

const AGE_BUCKETS: { label: string; value: string; test: (minutes: number) => boolean }[] = [
  { label: 'Under 30 min', value: 'lt30', test: (m) => m < 30 },
  { label: '30 min – 2 h', value: '30to120', test: (m) => m >= 30 && m < 120 },
  { label: '2 – 6 h', value: '2to6', test: (m) => m >= 120 && m < 360 },
  { label: 'Over 6 h', value: 'gt6', test: (m) => m >= 360 },
]

export function OperationsPage() {
  const { t } = useTranslation(['agent', 'common'])
  const ENGINE_OPTS = engineOptionsFor(useAuthStore((s) => s.me)?.engineKinds ?? [])
  const navigate = useNavigate()
  const { data: bookings = [], isLoading, dataUpdatedAt, isFetching } = useBookings()
  const { data: units = [] } = useUnits()
  const unitName = useMemo(() => new Map(units.map((u) => [u._id, u.identifier])), [units])
  const rows = bookings.filter((b) => ACTIVE.includes(b.status)).sort((a, b) => endMs(a) - endMs(b))

  const bucketOf = (b: Booking) => {
    const minutes = Math.max(0, Math.round((Date.now() - startedMs(b)) / 60_000))
    return AGE_BUCKETS.find((bucket) => bucket.test(minutes))?.value ?? 'lt30'
  }

  const columns: Column<Booking>[] = [
    { key: 'ref', header: t('common:column.reference'), sortValue: (b) => b.ref, filter: { kind: 'text', value: (b) => b.ref }, render: (b) => <RefLink to={`/bookings/${b.id}`}>{b.ref}</RefLink> },
    { key: 'client', header: t('common:column.client'), sortValue: (b) => b.customerName, filter: { kind: 'text', value: (b) => `${b.customerName} ${b.customerPhone}` }, render: (b) => <div><p className="font-medium text-navy dark:text-dk-text">{b.customerName || '—'}</p><p className="text-xs text-muted">{b.customerPhone}</p></div> },
    {
      key: 'engine', header: t('common:column.engine'),
      filter: { kind: 'select', options: ENGINE_OPTS, value: (b) => b.engineKind },
      render: (b) => <span className="inline-flex items-center gap-2"><Icon name={ENGINE_META[b.engineKind].icon} size={16} className="text-brand" /> <span className="text-muted">{engineLabel(b.engineKind)}</span></span>,
    },
    { key: 'product', header: t('common:column.product'), filter: { kind: 'text', value: (b) => b.productName }, sortValue: (b) => b.productName, render: (b) => b.productName },
    { key: 'unit', header: t('common:column.unit'), sortValue: (b) => unitName.get(b.assetUnitId ?? '') ?? '', render: (b) => <span className="font-mono text-xs">{unitName.get(b.assetUnitId ?? '') ?? '—'}</span> },
    {
      key: 'started',
      header: t('operations.started'),
      sortValue: (b) => startedMs(b),
      filter: { kind: 'select', options: AGE_BUCKETS.map(({ label, value }) => ({ label, value })), value: bucketOf },
      render: (b) => (
        <div>
          <p className="text-xs tabular-nums">{formatDateTime(startedMs(b))}</p>
          <p className="text-[11px] text-muted">{sinceLabel(startedMs(b))}</p>
        </div>
      ),
    },
    { key: 'status', header: t('common:column.status'), filter: { kind: 'select', options: STATUS_OPTS, value: (b) => b.status }, sortValue: (b) => b.status, render: (b) => <StatusBadge status={b.status} /> },
    {
      key: 'due',
      header: t('operations.due'),
      align: 'right',
      sortValue: (b) => b.amountDue ?? 0,
      render: (b) =>
        (b.amountDue ?? 0) > 0 ? (
          <Badge tone="warning" testId={`operations-due-${b.id}`}>{money(b.amountDue ?? 0)}</Badge>
        ) : (
          <span className="text-muted text-xs">{t('operations.settled')}</span>
        ),
    },
    { key: 'remaining', header: t('common:column.remaining'), align: 'right', sortValue: (b) => endMs(b), render: (b) => (b.session.startedAt ? <Timer expectedEndAt={b.session.expectedEndAt} /> : <span className="text-amber-600 text-xs">{t('operations.awaitingFulfilment')}</span>) },
    { key: 'action', header: '', align: 'right', render: (b) => <Button variant="secondary" onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${b.id}`) }}>{t('operations.open')}</Button> },
  ]

  return (
    <div data-testid="operations-page">
      <PageHeader
        helpId="operations"
        title={t('operations.title')}
        subtitle={t('operations.subtitle')}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.operations') }]}
        actions={<LiveIndicator updatedAt={dataUpdatedAt} fetching={isFetching} />}
      />
      {isLoading ? <Spinner /> : (
        <DataTable
          testId="operations-table"
          rows={rows}
          columns={columns}
          keyOf={(b) => b.id}
          onRowClick={(b) => navigate(`/bookings/${b.id}`)}
          empty={{ title: t('operations.emptyTitle'), message: t('operations.emptyMessage') }}
        />
      )}
    </div>
  )
}
