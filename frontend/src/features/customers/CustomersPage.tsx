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
import { customerProblems } from '@/utils'

export function CustomersPage() {
  const { t } = useTranslation(['agent', 'ui', 'common'])
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const { data: rows = [], isLoading } = useCustomers(q.trim() || undefined)
  const createMut = useCreateCustomer()

  const problems = customerProblems({ name, phone, email })
  const problemFor = (field: 'name' | 'phone' | 'email') => problems.find((p) => p.field === field)

  const submit = async () => {
    if (problems.length > 0) { setTouched(true); return }
    const c = await createMut.mutateAsync({ name, phone, email: email.trim() || undefined })
    toast('success', t('customers.created'), c.name)
    setOpen(false); setName(''); setPhone(''); setEmail(''); setTouched(false)
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
            { key: 'email', header: t('common:column.email'), filter: { kind: 'text', value: (c) => c.email ?? '' }, render: (c) => <span className="text-muted">{c.email || '—'}</span> },
            { key: 'created', header: t('common:column.added'), align: 'right', sortValue: (c) => new Date(c.createdAt).getTime(), render: (c) => <span className="text-muted">{formatDateTime(new Date(c.createdAt).getTime())}</span> },
          ]}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('customers.newCustomer')} testId="customer-modal"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common:action.cancel')}</Button><Button onClick={submit} loading={createMut.isPending} disabled={problems.length > 0} data-testid="customer-modal-submit">{t('common:action.create')}</Button></>}>
        <Field
          label={t('ui:customer.fullName')}
          required
          error={touched && problemFor('name') ? t(problemFor('name')!.messageKey) : undefined}
        >
          <input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} data-testid="cust-modal-name" />
        </Field>
        <Field
          label={t('ui:customer.phone')}
          required
          hint={t('ui:customer.phoneHint')}
          error={touched && problemFor('phone') ? t(problemFor('phone')!.messageKey) : undefined}
        >
          <PhoneInput value={phone} onChange={(v) => { setPhone(v); setTouched(true) }} testId="cust-modal-phone" />
        </Field>
        <Field
          label={t('ui:customer.email')}
          hint={t('ui:customer.emailHint')}
          error={touched && problemFor('email') ? t(problemFor('email')!.messageKey) : undefined}
        >
          <input type="email" className="lf-input" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} placeholder="name@example.com" data-testid="cust-modal-email" />
        </Field>
      </Modal>
    </div>
  )
}
