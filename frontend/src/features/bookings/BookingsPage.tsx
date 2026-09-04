import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge, Button, Spinner } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'
import { useBookings } from '@/hooks'
import { engineLabel, engineOptionsFor } from '@/config/engineMeta'
import { formatDateTime, money } from '@/utils'
import type { Booking } from '@/api/types'
import { RefLink } from '@/components/RefLink'
import { useAuthStore } from '@/store/auth'

const STATUS_OPTS = ['DRAFT', 'CONFIRMED', 'RESERVED', 'ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS', 'PREPARING', 'COMPLETED', 'CANCELLED'].map((s) => ({ label: s.replaceAll('_', ' '), value: s }))

export function BookingsPage() {
  const { t } = useTranslation(['agent', 'common'])
  const ENGINE_OPTS = engineOptionsFor(useAuthStore((s) => s.me)?.engineKinds ?? [])
  const navigate = useNavigate()
  const { data: all = [], isLoading } = useBookings()
  const rows = useMemo(() => [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [all])

  const columns: Column<Booking>[] = [
    { key: 'ref', header: t('common:column.reference'), sortValue: (b) => b.ref, filter: { kind: 'text', value: (b) => b.ref }, render: (b) => <RefLink to={`/bookings/${b.id}`}>{b.ref}</RefLink> },
    { key: 'client', header: t('common:column.client'), sortValue: (b) => b.customerName, filter: { kind: 'text', value: (b) => `${b.customerName} ${b.customerPhone}` }, render: (b) => <div><p className="font-medium text-navy dark:text-dk-text">{b.customerName || '—'}</p><p className="text-xs text-muted">{b.customerPhone}</p></div> },
    { key: 'engine', header: t('common:column.engine'), filter: { kind: 'select', options: ENGINE_OPTS, value: (b) => b.engineKind }, render: (b) => <span className="text-muted">{engineLabel(b.engineKind)}</span> },
    { key: 'product', header: t('common:column.product'), sortValue: (b) => b.productName, filter: { kind: 'text', value: (b) => b.productName }, render: (b) => b.productName },
    {
      key: 'price',
      header: t('common:column.price'),
      align: 'right',
      sortValue: (b) => b.amountCharged ?? b.totalAmount ?? 0,
      filter: { kind: 'text', value: (b) => String(b.amountCharged ?? b.totalAmount ?? 0) },
      render: (b) => (
        <div className="tabular-nums">
          <p className="font-medium text-navy dark:text-dk-text" data-testid={`booking-price-${b.id}`}>{money(b.amountCharged ?? b.totalAmount ?? 0)}</p>
          {(b.amountDue ?? 0) > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-300" data-testid={`booking-due-${b.id}`}>
              {t('bookings.owing', { amount: money(b.amountDue ?? 0) })}
            </p>
          )}
        </div>
      ),
    },
    { key: 'status', header: t('common:column.status'), sortValue: (b) => b.status, filter: { kind: 'select', options: STATUS_OPTS, value: (b) => b.status }, render: (b) => <StatusBadge status={b.status} /> },
    { key: 'date', header: t('common:column.created'), align: 'right', sortValue: (b) => new Date(b.createdAt).getTime(), render: (b) => <span className="text-muted">{formatDateTime(new Date(b.createdAt).getTime())}</span> },
  ]

  return (
    <div data-testid="bookings-page">
      <PageHeader helpId="bookings" title={t('bookings.title')} subtitle={t('bookings.subtitle')} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.bookings') }]}
        actions={<Button onClick={() => navigate('/pos')}>{t('bookings.newTransaction')}</Button>} />
      {isLoading ? <Spinner /> : (
        <DataTable
          testId="bookings-table"
          rows={rows}
          columns={columns}
          keyOf={(b) => b.id}
          onRowClick={(b) => navigate(`/bookings/${b.id}`)}
          empty={{ title: 'No bookings', message: 'Start a new transaction from the POS.' }}
        />
      )}
    </div>
  )
}
