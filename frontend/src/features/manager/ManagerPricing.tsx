import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Plus, Tag, Info } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, Field, FieldGroupTitle, Spinner, Badge } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { useCreateProduct, useManagerPricing, useUpdateProduct } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { ENGINE_META, engineLabel, productIcon } from '@/config/engineMeta'
import { Icon } from '@/components/Icon'
import type { EngineKind } from '@/api/types'
import type { PricingProduct } from '@/api/manager.api'

export function ManagerPricing() {
  const { t } = useTranslation(['manager', 'common'])
  const { data, isLoading } = useManagerPricing()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const [editing, setEditing] = useState<PricingProduct | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  const fail = (e: unknown) => toast('danger', t('common:error.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
  const money = (n: number) => `${n.toFixed(2)} ${data?.currency ?? 'SAR'}`

  const openCreate = () => {
    setForm({ name: '', engineKind: 'SHOP_AND_DROP', category: 'General', basePrice: '0', hourlyPrice: '', tourPrice: '', tourMinutes: '', overtimeHourlyRate: '', depositRequired: '0', billingModel: 'PER_BAG', assetTypeId: '' })
    setCreating(true)
  }

  const openEdit = (p: PricingProduct) => {
    setForm({
      name: p.name,
      engineKind: p.engineKind,
      category: p.category,
      basePrice: String(p.basePrice),
      hourlyPrice: p.hourlyPrice == null ? '' : String(p.hourlyPrice),
      tourPrice: p.tourPrice == null ? '' : String(p.tourPrice),
      tourMinutes: p.tourMinutes == null ? '' : String(p.tourMinutes),
      overtimeHourlyRate: p.overtimeHourlyRate == null ? '' : String(p.overtimeHourlyRate),
      depositRequired: String(p.depositRequired),
      billingModel: p.billingModel,
      assetTypeId: p.assetTypeId ?? '',
    })
    setEditing(p)
  }

  const payload = () => ({
    name: form.name,
    engineKind: form.engineKind as EngineKind,
    category: form.category,
    basePrice: Number(form.basePrice || 0),
    hourlyPrice: form.hourlyPrice === '' || form.hourlyPrice == null ? null : Number(form.hourlyPrice),
    tourPrice: form.tourPrice === '' || form.tourPrice == null ? null : Number(form.tourPrice),
    tourMinutes: form.tourMinutes === '' || form.tourMinutes == null ? null : Number(form.tourMinutes),
    overtimeHourlyRate: form.overtimeHourlyRate === '' ? null : Number(form.overtimeHourlyRate),
    depositRequired: Number(form.depositRequired || 0),
    billingModel: form.billingModel,
    assetTypeId: form.assetTypeId || null,
  })

  const submit = () => {
    if (editing) {
      updateProduct.mutate({ id: editing._id, patch: payload() }, { onSuccess: () => { toast('success', t('pricing.priceUpdated'), t('pricing.priceNote')); setEditing(null) }, onError: fail })
    } else {
      createProduct.mutate(payload(), { onSuccess: () => { toast('success', t('pricing.productCreated')); setCreating(false) }, onError: fail })
    }
  }

  const toggleActive = (p: PricingProduct) => {
    updateProduct.mutate(
      { id: p._id, patch: { active: !p.active } },
      { onSuccess: () => toast(p.active ? 'warning' : 'success', p.active ? 'Product retired' : 'Product restored'), onError: fail },
    )
  }

  if (isLoading || !data) {
    return (
      <div data-testid="manager-pricing">
        <PageHeader title={t('pricing.title')} subtitle={t('pricing.loading')} />
        <Spinner />
      </div>
    )
  }

  const typesForEngine = data.assetTypes.filter((t) => t.engineKind === (form.engineKind as EngineKind))

  return (
    <div data-testid="manager-pricing">
      <PageHeader
        title={t('pricing.title')}
        subtitle={t('pricing.subtitle')}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.pricing') }]}
        actions={<Button onClick={openCreate} data-testid="pricing-add"><Plus size={16} />{t('pricing.addProduct')}</Button>}
      />

      <Card className="mb-5 flex items-start gap-3">
        <Info size={18} className="text-brand shrink-0 mt-0.5" />
        <p className="text-sm text-muted">
          <Trans
            i18nKey="manager:pricing.note"
            values={{ vat: (data.vatRate * 100).toFixed(0) }}
            components={{ 1: <strong className="text-navy dark:text-dk-texthi" /> }}
          />
        </p>
      </Card>

      <DataTable
        testId="pricing-table"
        rows={data.products}
        keyOf={(r) => r._id}
        empty={{ title: t('pricing.noProducts'), message: t('pricing.addFirst') }}
        columns={[
          {
            key: 'name',
            header: t('common:column.product'),
            sortValue: (r) => r.name,
            filter: { kind: 'text', value: (r) => r.name },
            render: (r) => (
              <div>
                <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-2">
                  <Icon name={productIcon(r.name, r.engineKind)} size={16} className="text-brand shrink-0" />
                  {r.name}
                </p>
                <p className="text-xs text-muted">{r.assetTypeName ?? t('pricing.noAsset')} · {r.category}</p>
              </div>
            ),
          },
          {
            key: 'engine',
            header: t('common:column.service'),
            filter: { kind: 'select', options: Object.keys(ENGINE_META).map((e) => ({ label: engineLabel(e as EngineKind), value: e })), value: (r) => r.engineKind },
            render: (r) => engineLabel(r.engineKind),
          },
          { key: 'billing', header: t('common:column.billing'), render: (r) => <Badge tone="neutral">{t(`status:billingModel.${r.billingModel}`, { defaultValue: r.billingModel.replaceAll('_', ' ') })}</Badge> },
          { key: 'price', header: t('common:column.price'), align: 'right', sortValue: (r) => r.basePrice, render: (r) => <strong className="tabular-nums">{money(r.basePrice)}</strong> },
          {
            key: 'overtime',
            header: t('common:column.overtimeh'),
            align: 'right',
            sortValue: (r) => r.effectiveOvertimeRate,
            render: (r) => (
              <span className="tabular-nums">
                {money(r.effectiveOvertimeRate)}
                {r.overtimeHourlyRate == null && <span className="text-[10px] text-muted ms-1">{t('pricing.fromBase')}</span>}
              </span>
            ),
          },
          { key: 'deposit', header: t('common:column.deposit'), align: 'right', render: (r) => (r.depositRequired > 0 ? money(r.depositRequired) : <span className="text-muted">—</span>) },
          {
            key: 'status',
            header: t('common:column.status'),
            filter: { kind: 'select', options: [{ label: t('common:label.active'), value: 'yes' }, { label: t('common:label.retired'), value: 'no' }], value: (r) => (r.active ? 'yes' : 'no') },
            render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? t('common:state.active') : t('common:state.retired')}</Badge>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r) }} data-testid={`pricing-edit-${r._id}`}>{t('common:action.edit')}</Button>
                <Button variant="ghost" onClick={(e) => { e.stopPropagation(); toggleActive(r) }}>{r.active ? t('common:action.retire') : t('common:action.restore')}</Button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null) }}
        title={editing ? `Edit ${editing.name}` : 'Add product'}
        size="lg"
        testId="pricing-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null) }}>{t('common:action.cancel')}</Button>
            <Button onClick={submit} loading={createProduct.isPending || updateProduct.isPending} disabled={!form.name?.trim()} data-testid="pricing-submit">
              {editing ? 'Save price' : 'Create'}
            </Button>
          </>
        }
      >
        <Field label={t('common:field.name')} required>
          <input className="lf-input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pricing-name" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('pricing.service')} required>
            <Select
              value={form.engineKind ?? 'SHOP_AND_DROP'}
              onChange={(v) => setForm({ ...form, engineKind: v, assetTypeId: '' })}
              options={Object.keys(ENGINE_META).map((e) => ({ label: engineLabel(e as EngineKind), value: e }))}
              testId="pricing-engine"
            />
          </Field>
          <Field label={t('pricing.assetType')} hint={t('pricing.assetTypeHint')}>
            <Select
              value={form.assetTypeId ?? ''}
              onChange={(v) => setForm({ ...form, assetTypeId: v })}
              options={[{ label: t('pricing.noAssetType'), value: '' }, ...typesForEngine.map((t) => ({ label: t.name, value: t._id }))]}
              testId="pricing-asset-type"
            />
          </Field>
        </div>

        <Field label={t('pricing.billingModel')} required hint={t('pricing.billingHint')}>
          <Select
            value={form.billingModel ?? 'PER_BAG'}
            onChange={(v) => setForm({ ...form, billingModel: v })}
            options={data.billingModels.map((b) => ({ label: b.replaceAll('_', ' '), value: b }))}
            testId="pricing-billing"
          />
        </Field>

        <FieldGroupTitle><Tag size={14} />{t('pricing.money')}</FieldGroupTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <Field label={`Base price (${data.currency})`} required>
            <input type="number" min={0} step="0.01" className="lf-input" value={form.basePrice ?? '0'} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} data-testid="pricing-base" />
          </Field>
          <Field label={`Overtime / hour (${data.currency})`} hint={t('pricing.overtimeHint')}>
            <input type="number" min={0} step="0.01" className="lf-input" value={form.overtimeHourlyRate ?? ''} onChange={(e) => setForm({ ...form, overtimeHourlyRate: e.target.value })} placeholder={t('pricing.fromBase')} data-testid="pricing-overtime" />
          </Field>
          <Field label={`Deposit (${data.currency})`} hint={t('pricing.depositHint')}>
            <input type="number" min={0} step="0.01" className="lf-input" value={form.depositRequired ?? '0'} onChange={(e) => setForm({ ...form, depositRequired: e.target.value })} />
          </Field>
        </div>

        <FieldGroupTitle><Tag size={14} />{t('pricing.rates')}</FieldGroupTitle>
        <p className="text-xs text-muted -mt-2 mb-3">{t('pricing.ratesHint')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <Field label={`${t('pricing.hourly')} (${data.currency})`} hint={t('pricing.hourlyHint')}>
            <input type="number" min={0} step="0.01" className="lf-input" value={form.hourlyPrice ?? ''} onChange={(e) => setForm({ ...form, hourlyPrice: e.target.value })} placeholder={t('pricing.fromBase')} data-testid="pricing-hourly" />
          </Field>
          <Field label={`${t('pricing.perTour')} (${data.currency})`} hint={t('pricing.perTourHint')}>
            <input type="number" min={0} step="0.01" className="lf-input" value={form.tourPrice ?? ''} onChange={(e) => setForm({ ...form, tourPrice: e.target.value })} data-testid="pricing-tour" />
          </Field>
          <Field label={t('pricing.tourMinutes')} hint={t('pricing.tourMinutesHint')}>
            <input type="number" min={1} step="1" className="lf-input" value={form.tourMinutes ?? ''} onChange={(e) => setForm({ ...form, tourMinutes: e.target.value })} placeholder="60" data-testid="pricing-tour-minutes" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
