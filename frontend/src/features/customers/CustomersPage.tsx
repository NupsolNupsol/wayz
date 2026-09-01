import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, Field, Spinner } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { PhoneInput } from '@/components/PhoneInput'
import { useCustomers, useCreateCustomer } from '@/hooks'
import { formatDateTime } from '@/utils'
import { toast } from '@/state/toastStore'

export function CustomersPage() {
  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const { data: rows = [], isLoading } = useCustomers(q.trim() || undefined)
  const createMut = useCreateCustomer()

  const submit = async () => {
    const c = await createMut.mutateAsync({ name, phone })
    toast('success', t('customers.created'), c.name)
    setOpen(false); setName(''); setPhone('')
  }

  return (
    <div data-testid="customers-page">
      <PageHeader helpId="customers" title={t('customers.title')} subtitle={t('common:table.records', { count: rows.length })} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.customers') }]}
        actions={<Button onClick={() => setOpen(true)} data-testid="customers-new"><UserPlus size={16} />{t('customers.newCustomer')}</Button>} />

      <Card className="mb-4 !p-3">
        <div className="relative">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="lf-input ps-9" placeholder={t('customers.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="customers-search" />
        </div>
      </Card>

      {isLoading ? <Spinner /> : (
        <DataTable
          testId="customers-table"
          rows={rows}
          keyOf={(c) => c._id}
          onRowClick={(c) => navigate(`/customers/${c._id}`)}
          empty={{ title: 'No customers', message: 'Create one to get started.' }}
          columns={[
            { key: 'name', header: t('common:column.name'), sortValue: (c) => c.name, filter: { kind: 'text', value: (c) => c.name }, render: (c) => <span className="font-semibold text-navy dark:text-dk-text">{c.name}</span> },
            { key: 'phone', header: t('common:column.phone'), filter: { kind: 'text', value: (c) => c.phone }, render: (c) => c.phone },
            { key: 'created', header: t('common:column.added'), align: 'right', sortValue: (c) => new Date(c.createdAt).getTime(), render: (c) => <span className="text-muted">{formatDateTime(new Date(c.createdAt).getTime())}</span> },
          ]}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('customers.newCustomer')} testId="customer-modal"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} loading={createMut.isPending} disabled={!name.trim() || !phone.trim()} data-testid="customer-modal-submit">Create</Button></>}>
        <Field label="Full name" required><input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} data-testid="cust-modal-name" /></Field>
        <Field label="Phone" required><PhoneInput value={phone} onChange={setPhone} testId="cust-modal-phone" /></Field>
      </Modal>
    </div>
  )
}
