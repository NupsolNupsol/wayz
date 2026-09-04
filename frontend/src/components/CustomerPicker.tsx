import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserPlus, Check } from 'lucide-react'
import { useCustomers, useCreateCustomer } from '@/hooks'
import { Field, Button } from './ui'
import { PhoneInput } from './PhoneInput'
import { toast } from '@/state/toastStore'
import { customerProblems } from '@/utils'
import type { Customer } from '@/api/types'

export function CustomerPicker({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const { t } = useTranslation('ui')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const { data: matches = [] } = useCustomers(query.trim() || undefined)
  const createMut = useCreateCustomer()

  const problems = customerProblems({ name, phone, email })
  const problemFor = (field: 'name' | 'phone' | 'email') => problems.find((p) => p.field === field)

  const submitCreate = async () => {
    if (problems.length > 0) return
    const c = await createMut.mutateAsync({ name, phone, email: email.trim() || undefined })
    onChange(c)
    setCreating(false)
    setName('')
    setPhone('')
    setEmail('')
    toast('success', t('customer.created'), c.name)
  }

  if (value) {
    return (
      <div className="lf-card p-3 flex items-center gap-3" data-testid="customer-selected">
        <div className="w-9 h-9 rounded-full bg-success/10 text-success flex items-center justify-center"><Check size={18} /></div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-navy dark:text-dk-texthi">{value.name}</p>
          <p className="text-xs text-muted">{value.phone}{value.email ? ` · ${value.email}` : ''}</p>
        </div>
        <Button variant="ghost" onClick={() => onChange(null)} data-testid="customer-change">{t('customer.change')}</Button>
      </div>
    )
  }

  return (
    <div>
      {!creating ? (
        <>
          <div className="flex items-center justify-start gap-3 mb-3">
            <Button onClick={() => { setCreating(true); setName(query) }} data-testid="customer-new">
              <UserPlus size={16} />{t('customer.newCustomer')}
            </Button>
            <p className="text-xs text-muted">{t('customer.orSearch')}</p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input data-testid="customer-search" className="lf-input ps-9" placeholder={t('customer.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {query.trim() && matches.length > 0 && (
            <div className="mt-2 lf-card p-1" data-testid="customer-matches">
              {matches.slice(0, 6).map((c) => (
                <button key={c._id} onClick={() => onChange(c)} data-testid={`customer-opt-${c._id}`} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-canvas dark:hover:bg-dk-elevated text-start text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted text-xs">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="lf-card p-4" data-testid="customer-create-form">
          <Field
            label={t('customer.fullName')}
            required
            htmlFor="cust-name"
            error={touched && problemFor('name') ? t(problemFor('name')!.messageKey) : undefined}
          >
            <input id="cust-name" className="lf-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} data-testid="customer-name-input" />
          </Field>
          <Field
            label={t('customer.phone')}
            required
            hint={t('customer.phoneHint')}
            error={touched && problemFor('phone') ? t(problemFor('phone')!.messageKey) : undefined}
          >
            <PhoneInput value={phone} onChange={(v) => { setPhone(v); setTouched(true) }} testId="customer-phone" />
          </Field>
          <Field
            label={t('customer.email')}
            hint={t('customer.emailHint')}
            error={touched && problemFor('email') ? t(problemFor('email')!.messageKey) : undefined}
          >
            <input type="email" className="lf-input" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} placeholder="name@example.com" data-testid="customer-email" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('customer.cancel')}</Button>
            <Button onClick={submitCreate} loading={createMut.isPending} disabled={problems.length > 0} data-testid="customer-create-submit">{t('customer.createSelect')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
