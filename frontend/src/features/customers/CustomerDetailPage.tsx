import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, Calendar } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle, StatusBadge, EmptyState, Spinner } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { useCustomer, useBookings } from '@/hooks'
import { formatDateTime } from '@/utils'
import { RefLink } from '@/components/RefLink'

export function CustomerDetailPage() {
  const { t } = useTranslation('common')
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id)
  const { data: allBookings = [] } = useBookings()

  if (isLoading) return <Spinner />
  if (!customer) {
    return (
      <div>
        <PageHeader helpId="customers" title="Customer" crumbs={[{ label: t('common:crumb.customers'), to: '/customers' }, { label: t('common:crumb.notfound') }]} />
        <Card><EmptyState title="Customer not found" /></Card>
      </div>
    )
  }
  const bookings = allBookings.filter((b) => b.customerId === customer._id)

  return (
    <div data-testid="customer-detail">
      <PageHeader title={customer.name} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.customers'), to: '/customers' }, { label: customer.name }]} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <SectionTitle className="mb-3">Contact</SectionTitle>
          <div className="flex items-center gap-2 text-sm mb-2"><Phone size={15} className="text-muted" /> {customer.phone}</div>
          <div className="flex items-center gap-2 text-sm"><Calendar size={15} className="text-muted" /> Added {formatDateTime(new Date(customer.createdAt).getTime())}</div>
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-3">Booking history</SectionTitle>
          <DataTable
            rows={bookings}
            keyOf={(b) => b.id}
            onRowClick={(b) => navigate(`/bookings/${b.id}`)}
            empty={{ title: 'No bookings yet' }}
            columns={[
              { key: 'ref', header: t('common:column.reference'), sortValue: (b) => b.ref, render: (b) => <RefLink to={`/bookings/${b.id}`}>{b.ref}</RefLink> },
              { key: 'product', header: t('common:column.product'), render: (b) => b.productName },
              { key: 'status', header: t('common:column.status'), render: (b) => <StatusBadge status={b.status} /> },
              { key: 'date', header: t('common:column.date'), render: (b) => <span className="text-muted">{formatDateTime(new Date(b.createdAt).getTime())}</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
