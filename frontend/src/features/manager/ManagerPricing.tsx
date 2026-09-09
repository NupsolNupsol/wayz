import { useState } from 'react'
import { localName } from '@/utils'
import { clsx } from 'clsx'
import { Trans, useTranslation } from 'react-i18next'
import { Plus, Tag, Info } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, Field, FieldGroupTitle, Spinner, Badge } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { assetApi } from '@/api/asset.api'
import { useCreateProduct, useManagerPricing, useUpdateProduct } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { PRODUCT_ICONS, billingLabel, engineLabel, productIconFor, visibleEngineOptions } from '@/config/engineMeta'
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
    setForm({ name: '', nameAr: '', emoji: 'Package', engineKind: 'SHOP_AND_DROP', category: 'General', basePrice: '0', hourlyPrice: '', tourPrice: '', tourMinutes: '', overtimeHourlyRate: '', depositRequired: '0', billingModel: 'PER_BAG', assetTypeId: '', stationId: '', kioskId: '', initialCount: '' })
    setCreating(true)
  }

  const openEdit = (p: PricingProduct) => {
    setForm({
      name: p.name,
      nameAr: p.nameAr ?? '',
      emoji: p.emoji ?? 'Package',
      engineKind: p.engineKind,
      category: p.category,
      basePrice: String(p.basePrice),
      hourlyPrice: p.hourlyPrice == null ? '' : String(p.hourlyPrice),
      tourPrice: p.tourPrice == null ? '' : String(p.tourPrice),
      tourMinutes: p.tourMinutes == null ? '' : String(p.tourMinutes),
      overtimeHourlyRate: p.overtimeHourlyRate == null ? '' : String(p.overtimeHourlyRate),
      depositRequired: String(p.depositRequired),
      billingModel: p.billingModel,
      stationId: p.stationId ?? '',
      kioskId: p.kioskId ?? '',
      initialCount: p.unitsHere == null ? '' : String(p.unitsHere),
      assetTypeId: p.assetTypeId ?? '',
    })
    setEditing(p)
  }

  const payload = () => ({
    name: form.name,
    nameAr: form.nameAr || undefined,
    emoji: form.emoji || undefined,
    engineKind: form.engineKind as EngineKind,
    category: form.category,
    basePrice: Number(form.basePrice || 0),
    hourlyPrice: form.hourlyPrice === '' || form.hourlyPrice == null ? null : Number(form.hourlyPrice),
    tourPrice: form.tourPrice === '' || form.tourPrice == null ? null : Number(form.tourPrice),
    tourMinutes: form.tourMinutes === '' || form.tourMinutes == null ? null : Number(form.tourMinutes),
    overtimeHourlyRate: form.overtimeHourlyRate === '' ? null : Number(form.overtimeHourlyRate),
    depositRequired: Number(form.depositRequired || 0),
    billingModel: form.billingModel,
    ...(form.assetTypeId && Number(form.initialCount) > 0
      ? {
          stationId: form.stationId || undefined,
          kioskId: form.kioskId || undefined,
          initialCount: Number(form.initialCount),
        }
      : {}),
    assetTypeId: form.assetTypeId || null,
  })

  /** Seats belong to the thing, not the price, so this saves them onto the asset type. */
  const saveSeats = async () => {
    if (!carriesPeople || !form.assetTypeId) return
    const wanted = Number(form.seats)
    if (!Number.isFinite(wanted) || wanted < 1 || wanted === chosenType?.seats) return
    try {
      await assetApi.updateType(form.assetTypeId, { capacity: { seats: wanted, capacityScore: wanted } })
    } catch (e) {
      toast('danger', t('pricing.seatsFailed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    }
  }

  const submit = async () => {
    await saveSeats()
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

  // Only what this activity can actually be charged by. A lagoon trip has a captain and a route,
  // not a meter, so an hourly or per-bag price would be refused by the API anyway.
  // A trip has no hours in it: nothing that prices by time belongs on the form for one.
  const timed = form.billingModel === 'DURATION_BASED' || (data.billingByEngine?.[form.engineKind as EngineKind] ?? []).includes('DURATION_BASED')

  const stationsForEngine = (data.stations ?? []).filter((st) =>
    st.engineKinds.includes(form.engineKind as EngineKind),
  )
  const desksForStation = (data.kiosks ?? []).filter(
    (k) => k.stationId === form.stationId && k.engineKind === (form.engineKind as EngineKind),
  )

  // Mobility and lagoon carry people, so how many fit is part of pricing the thing.
  const carriesPeople = form.engineKind === 'MOBILITY' || form.engineKind === 'LAGOON'
  const chosenType = typesForEngine.find((tp) => tp._id === form.assetTypeId)

  const billingForEngine =
    data.billingByEngine?.[form.engineKind as EngineKind] ?? data.billingModels

  const pickService = (engineKind: string) => {
    const allowed = data.billingByEngine?.[engineKind as EngineKind] ?? data.billingModels
    const keep = allowed.includes(form.billingModel as (typeof allowed)[number])
    setForm({
      ...form,
      engineKind,
      assetTypeId: '',
      billingModel: keep ? form.billingModel : allowed[0],
    })
  }

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
            sortValue: (r) => localName(r),
            filter: { kind: 'text', value: (r) => `${r.name} ${r.nameAr ?? ''}` },
            render: (r) => (
              <div>
                <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-2">
                  <Icon name={productIconFor(r, r.engineKind)} size={16} className="text-brand shrink-0" />
                  {localName(r)}
                </p>
                <p className="text-xs text-muted">{r.assetTypeName ?? t('pricing.noAsset')} · {r.category}</p>
              </div>
            ),
          },
          {
            key: 'engine',
            header: t('common:column.service'),
            filter: { kind: 'select', options: visibleEngineOptions(), value: (r) => r.engineKind },
            render: (r) => engineLabel(r.engineKind),
          },
          {
            key: 'billing',
            header: t('common:column.billing'),
            render: (r) => <Badge tone="neutral">{billingLabel(r.billingModel, r.engineKind)}</Badge>,
          },
          {
            key: 'station',
            header: t('common:field.station'),
            render: (r) => (r.stationName ? <span className="text-sm">{r.stationName}</span> : <span className="text-muted">{t('pricing.everywhere')}</span>),
            sortValue: (r) => r.stationName ?? '',
          },
          {
            key: 'kiosk',
            header: t('common:field.kiosk'),
            render: (r) => (r.kioskName ? <span className="text-sm">{r.kioskName}</span> : <span className="text-muted">{t('pricing.everywhere')}</span>),
            sortValue: (r) => r.kioskName ?? '',
          },
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
            <Button onClick={() => void submit()} loading={createProduct.isPending || updateProduct.isPending} disabled={!form.name?.trim()} data-testid="pricing-submit">
              {editing ? 'Save price' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('common:field.name')} required>
            <input className="lf-input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pricing-name" />
          </Field>
          <Field label={t('pricing.nameAr')} hint={t('pricing.nameArHint')}>
            <input
              className="lf-input"
              dir="rtl"
              value={form.nameAr ?? ''}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              data-testid="pricing-name-ar"
            />
          </Field>
        </div>

        <Field label={t('pricing.icon')} hint={t('pricing.iconHint')}>
          <div className="flex flex-wrap gap-1.5" data-testid="pricing-icons">
            {PRODUCT_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setForm({ ...form, emoji: icon })}
                data-testid={`pricing-icon-${icon}`}
                title={icon}
                className={clsx(
                  'w-10 h-10 rounded-xl2 border flex items-center justify-center',
                  form.emoji === icon ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand',
                )}
              >
                <Icon name={icon} size={20} />
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('pricing.service')} required>
            <Select
              value={form.engineKind ?? 'SHOP_AND_DROP'}
              onChange={pickService}
              options={visibleEngineOptions()}
              testId="pricing-engine"
            />
          </Field>
          <Field label={t('pricing.assetType')} hint={typesForEngine.length ? t('pricing.assetTypeHint') : t('pricing.noTypesYet')}>
            <Select
              value={form.assetTypeId ?? ''}
              onChange={(v) =>
                setForm({
                  ...form,
                  assetTypeId: v,
                  seats: String(typesForEngine.find((tp) => tp._id === v)?.seats ?? ''),
                })
              }
              options={[{ label: t('pricing.noAssetType'), value: '' }, ...typesForEngine.map((t) => ({ label: t.name, value: t._id }))]}
              testId="pricing-asset-type"
            />
          </Field>
        </div>

        {carriesPeople && form.assetTypeId && (
          <Field label={t('pricing.seats')} required hint={t('pricing.seatsHint', { name: chosenType?.name ?? '' })}>
            <NumberInput
              min={1}
              max={99}
              value={Number(form.seats || chosenType?.seats || 1)}
              onChange={(v) => setForm({ ...form, seats: String(v) })}
              testId="pricing-seats"
            />
          </Field>
        )}

        <div className="rounded-xl2 border border-line dark:border-dk-border p-3 mb-1" data-testid="pricing-stock">
          <FieldGroupTitle><Tag size={14} />{t('pricing.whereSold')}</FieldGroupTitle>
          <p className="text-xs text-muted -mt-2 mb-3">{t('pricing.whereSoldHint')}</p>
          {form.assetTypeId && editing && (editing.stockedAt ?? []).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5" data-testid="pricing-stocked-now">
              <span className="text-xs text-muted me-1">{t('pricing.stockedNow')}</span>
              {(editing.stockedAt ?? []).map((place) => (
                <Badge key={`${place.stationId}-${place.kioskId}`} tone="neutral">
                  {place.kioskName || place.stationName} · {place.count}
                </Badge>
              ))}
            </div>
          )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
              <Field label={t('common:field.station')}>
                <Select
                  value={form.stationId ?? ''}
                  onChange={(v) => setForm({ ...form, stationId: v, kioskId: '' })}
                  options={[
                    { label: t('pricing.everywhere'), value: '' },
                    ...stationsForEngine.map((st) => ({ label: st.name, value: st._id })),
                  ]}
                  testId="pricing-station"
                />
              </Field>
              <Field label={t('common:field.kiosk')}>
                <Select
                  value={form.kioskId ?? ''}
                  onChange={(v) => setForm({ ...form, kioskId: v })}
                  options={[
                    { label: t('pricing.anyDeskThere'), value: '' },
                    ...desksForStation.map((k) => ({ label: k.name, value: k._id })),
                  ]}
                  disabled={!form.stationId}
                  testId="pricing-kiosk"
                />
              </Field>
              {form.assetTypeId && (
                <Field label={t('pricing.howManyHere')} hint={t('pricing.howManyHereHint')}>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    className="lf-input"
                    value={form.initialCount ?? ''}
                    onChange={(e) => setForm({ ...form, initialCount: e.target.value })}
                    placeholder="0"
                    data-testid="pricing-count"
                  />
                </Field>
              )}
            </div>
        </div>

        <Field label={t('pricing.billingModel')} required hint={t('pricing.billingHint')}>
          <Select
            value={form.billingModel ?? 'PER_BAG'}
            onChange={(v) => setForm({ ...form, billingModel: v })}
            options={billingForEngine.map((b) => ({ label: billingLabel(b, form.engineKind as EngineKind), value: b }))}
            testId="pricing-billing"
          />
        </Field>

        <FieldGroupTitle><Tag size={14} />{t('pricing.money')}</FieldGroupTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <Field label={`Base price (${data.currency})`} required>
            <input type="number" min={0} step="0.01" className="lf-input" value={form.basePrice ?? '0'} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} data-testid="pricing-base" />
          </Field>
          {timed && (
            <Field label={`Overtime / hour (${data.currency})`} hint={t('pricing.overtimeHint')}>
              <input type="number" min={0} step="0.01" className="lf-input" value={form.overtimeHourlyRate ?? ''} onChange={(e) => setForm({ ...form, overtimeHourlyRate: e.target.value })} placeholder={t('pricing.fromBase')} data-testid="pricing-overtime" />
            </Field>
          )}
          <Field label={`Deposit (${data.currency})`} hint={t('pricing.depositHint')}>
            <input type="number" min={0} step="0.01" className="lf-input" value={form.depositRequired ?? '0'} onChange={(e) => setForm({ ...form, depositRequired: e.target.value })} />
          </Field>
        </div>

        {timed && (
          <>
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
          </>
        )}
      </Modal>
    </div>
  )
}
