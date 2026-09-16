import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Boxes, Pencil, Plus, QrCode, Tag, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Spinner, StatCard, StatusBadge } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { RefText } from '@/components/RefLink'
import { AssetQrModal } from './AssetQrModal'
import {
  useAddAssetUnits,
  useAssetType,
  usePriceAssetType,
  useRemoveAssetUnit,
  useUpdateAssetUnit,
} from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { billingLabel, engineLabel } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { KindEditorModal } from './KindEditorModal'
import { useManagerPricing } from '@/hooks'
import { Icon } from '@/components/Icon'
import type { PricingProduct } from '@/api/manager.api'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'
import { SALE_TYPES, SALE_UNITS, type AssetUnitRow, type SaleType, type SaleUnit } from '@/api/asset.api'

const SETTABLE = ['AVAILABLE', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED']

export function AssetTypeDetailPage() {
  const { t } = useTranslation(['assets', 'common'])
  const { id } = useParams()
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.me?.role)
  const mayManage = can(role, 'assets.manage')

  const { data, isLoading } = useAssetType(id)
  const addUnits = useAddAssetUnits()
  const updateUnit = useUpdateAssetUnit()
  const removeUnit = useRemoveAssetUnit()
  const priceType = usePriceAssetType()
  const pricing = useManagerPricing()

  const [addOpen, setAddOpen] = useState(false)
  const [stationId, setStationId] = useState('')
  const [kioskId, setKioskId] = useState('')
  const [count, setCount] = useState(4)

  const [editing, setEditing] = useState<AssetUnitRow | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [note, setNote] = useState('')
  const [ownPrice, setOwnPrice] = useState(false)
  const [unitPrice, setUnitPrice] = useState(0)
  const [moveStation, setMoveStation] = useState('')
  const [moveKiosk, setMoveKiosk] = useState('')

  const [qrFor, setQrFor] = useState<AssetUnitRow | null>(null)
  const [removing, setRemoving] = useState<AssetUnitRow | null>(null)
  const [freeing, setFreeing] = useState<AssetUnitRow | null>(null)

  const [priceOpen, setPriceOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<PricingProduct | null>(null)
  const [penalty, setPenalty] = useState(0)
  const [saleUnit, setSaleUnit] = useState<SaleUnit>('ITEM')
  const [saleType, setSaleType] = useState<SaleType>('RENTAL')
  const [ownPenalty, setOwnPenalty] = useState(false)
  const [unitPenalty, setUnitPenalty] = useState(0)
  const [basePrice, setBasePrice] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [overtime, setOvertime] = useState(0)
  const [clearOverrides, setClearOverrides] = useState(false)

  if (isLoading || !data || !id) {
    return (
      <div data-testid="asset-type-detail">
        <PageHeader title={t('title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const type = data.assetType
  /*
   * Lockers go into a gate; everything else onto a desk.
   *
   * The kind decides, not the person filling in the form — a compartment provisioned onto a
   * counter would be invisible to the gate that has to hold it and unreachable by the courier who
   * has to fill it. The server enforces the same rule, so this is the form agreeing with it
   * rather than the form deciding it.
   */
  const atAGate = data.assetType.kind === 'COMPARTMENT'
  const kiosksHere = data.kiosks.filter((k) => k.stationId === stationId)
  const gatesHere = (data.gates ?? []).filter((g) => g.stationId === stationId)
  const placesHere = atAGate ? gatesHere : kiosksHere

  const stationsForType = data.stations.filter((st) => st.engineKinds.includes(type.engineKind))
  const desksForMove = data.kiosks.filter((k) => k.stationId === moveStation)

  const openAdd = () => {
    setStationId(data.stations.find((s) => s.engineKinds.includes(type.engineKind))?._id ?? data.stations[0]?._id ?? '')
    setKioskId('')
    setCount(4)
    setAddOpen(true)
  }

  const submitAdd = () => {
    addUnits.mutate(
      { id, body: { stationId, ...(atAGate ? { gateId: kioskId || null } : { kioskId: kioskId || null }), count } },
      {
        onSuccess: (r) => {
          toast('success', t('toast.added', { count: r.created }), r.identifiers.slice(0, 6).join(', '))
          setAddOpen(false)
        },
        onError: (e) => toast('danger', t('toast.couldNotAdd'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const openEdit = (unit: AssetUnitRow) => {
    setEditing(unit)
    setIdentifier(unit.identifier)
    setStatus(SETTABLE.includes(unit.status) ? unit.status : 'AVAILABLE')
    setNote(unit.note)
    setOwnPrice(unit.priceOverride !== null)
    setUnitPrice(unit.priceOverride ?? type.basePrice ?? 0)
    setOwnPenalty(unit.penaltyPrice !== null)
    setUnitPenalty(unit.penaltyPrice ?? type.penaltyPrice ?? 0)
    setMoveStation(unit.stationId)
    setMoveKiosk(unit.kioskId ?? '')
  }

  const submitEdit = () => {
    if (!editing) return
    const busy = !SETTABLE.includes(editing.status)
    updateUnit.mutate(
      {
        id: editing._id,
        body: {
          identifier,
          note,
          priceOverride: ownPrice ? unitPrice : null,
          penaltyPrice: ownPenalty ? unitPenalty : null,
          ...(moveStation && moveStation !== editing.stationId ? { stationId: moveStation } : {}),
          ...((moveKiosk || null) !== editing.kioskId ? { kioskId: moveKiosk || null } : {}),
          ...(busy || status === editing.status ? {} : { status }),
        },
      },
      {
        onSuccess: () => {
          toast('success', t('toast.unitSaved', { identifier }))
          setEditing(null)
        },
        onError: (e) => toast('danger', t('toast.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const quickStatus = (unit: AssetUnitRow, next: string) =>
    updateUnit.mutate(
      { id: unit._id, body: { status: next } },
      {
        onSuccess: () => toast('success', t('toast.unitSaved', { identifier: unit.identifier })),
        onError: (e) => toast('danger', t('toast.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )

  const submitRemove = () => {
    if (!removing) return
    removeUnit.mutate(removing._id, {
      onSuccess: (r) => {
        toast('warning', t('toast.removed', { identifier: r.identifier }))
        setRemoving(null)
      },
      onError: (e) => toast('danger', t('toast.couldNotRemove'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
    })
  }

  /** Everything this kind is sold as. A kind usually has one, but nothing stops it having more. */
  const kindProducts = (pricing.data?.products ?? []).filter((p) => p.assetTypeId === id)

  const openPrice = () => {
    setBasePrice(type.basePrice ?? 0)
    setDeposit(type.depositRequired ?? 0)
    setOvertime(type.overtimeHourlyRate ?? 0)
    setPenalty(type.penaltyPrice ?? 0)
    setSaleUnit(type.saleUnit ?? 'ITEM')
    setSaleType(type.saleType ?? 'RENTAL')
    setClearOverrides(false)
    setPriceOpen(true)
  }

  const submitPrice = () => {
    priceType.mutate(
      {
        id,
        body: {
          basePrice,
          depositRequired: deposit,
          penaltyPrice: penalty,
          saleUnit,
          saleType,
          overtimeHourlyRate: saleType === 'SALE' ? null : overtime || null,
          clearOverrides,
        },
      },
      {
        onSuccess: (r) => {
          toast('success', t('toast.priced', { name: type.name }), r.cleared ? t('toast.overridesCleared', { count: r.cleared }) : t('toast.appliesToAll'))
          setPriceOpen(false)
        },
        onError: (e) => toast('danger', t('toast.couldNotPrice'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const columns: Column<AssetUnitRow>[] = [
    {
      key: 'identifier',
      header: t('common:column.identifier'),
      sortValue: (r) => r.identifier,
      filter: { kind: 'text', value: (r) => r.identifier },
      render: (r) => <RefText>{r.identifier}</RefText>,
    },
    {
      key: 'status',
      header: t('common:column.status'),
      sortValue: (r) => r.status,
      filter: {
        kind: 'select',
        options: [...new Set(data.units.map((u) => u.status))].map((s) => ({ label: s.replaceAll('_', ' '), value: s })),
        value: (r) => r.status,
      },
      render: (r) => <StatusBadge status={r.status} group="unit" />,
    },
    {
      key: 'station',
      header: t('common:column.station'),
      sortValue: (r) => r.stationName,
      filter: { kind: 'select', options: data.stations.map((s) => ({ label: s.name, value: s.name })), value: (r) => r.stationName },
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm">{r.stationName}</p>
          {r.kioskName && <p className="text-xs text-muted">{r.kioskName}</p>}
        </div>
      ),
    },
    {
      key: 'price',
      header: t('table.price'),
      align: 'right',
      sortValue: (r) => r.effectivePrice ?? -1,
      render: (r) => (
        <div className="text-end">
          <span className="tabular-nums">{r.effectivePrice === null ? '—' : money(r.effectivePrice)}</span>
          {r.priceOverride !== null && (
            <Badge tone="warning" className="ms-2">{t('table.ownPrice')}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'booking',
      header: t('common:column.booking'),
      render: (r) =>
        r.currentBookingRef ? (
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${r.currentBookingId}`) }}
          >
            <RefText>{r.currentBookingRef}</RefText>
          </button>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'qr',
      header: t('table.qr'),
      align: 'center',
      render: (r) => (
        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setQrFor(r) }} data-testid={`asset-qr-${r._id}`}>
          <QrCode size={15} />
        </Button>
      ),
    },
  ]

  if (mayManage) {
    columns.push({
      key: 'actions',
      header: t('common:column.action'),
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {r.status === 'AVAILABLE' && (
            <Button variant="ghost" onClick={() => quickStatus(r, 'OUT_OF_SERVICE')} data-testid={`asset-suspend-${r._id}`}>
              {t('action.suspend')}
            </Button>
          )}
          {['OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(r.status) && (
            <Button variant="ghost" onClick={() => quickStatus(r, 'AVAILABLE')} data-testid={`asset-restore-${r._id}`}>
              {t('action.restore')}
            </Button>
          )}
          {!SETTABLE.includes(r.status) && (
            <Button variant="ghost" onClick={() => setFreeing(r)} data-testid={`asset-free-${r._id}`}>
              {t('action.forceFree')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => openEdit(r)} data-testid={`asset-edit-${r._id}`}>
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" onClick={() => setRemoving(r)} data-testid={`asset-remove-${r._id}`}>
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    })
  }

  return (
    <div data-testid="asset-type-detail">
      <PageHeader
        title={type.name}
        subtitle={`${engineLabel(type.engineKind)} · ${t(`kind.${type.kind}`, { defaultValue: type.kind })}`}
        helpId="assets"
        crumbs={[{ label: t('common:crumb.assets'), to: '/assets' }, { label: type.name }]}
        actions={
          mayManage ? (
            <>
              <Button variant="secondary" onClick={openPrice} data-testid="asset-type-price">
                <Tag size={16} />{t('action.priceAll')}</Button>
              <Button onClick={openAdd} data-testid="asset-type-add">
                <Plus size={16} />{t('action.add')}</Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label={t('table.total')} value={type.total} icon={<Boxes size={18} />} testId="asset-detail-total" />
        <StatCard label={t('table.inUse')} value={type.inUse} tone="info" testId="asset-detail-inuse" />
        <StatCard label={t('table.free')} value={type.available} tone="success" testId="asset-detail-free" />
        <StatCard label={t('table.down')} value={type.outOfService} tone={type.outOfService ? 'danger' : 'neutral'} testId="asset-detail-down" />
        <StatCard
          label={t('table.price')}
          value={type.basePrice === null ? '—' : money(type.basePrice)}
          sublabel={type.productName ?? t('price.noProductShort')}
          testId="asset-detail-price"
        />
      </div>

      {/*
        What this kind is sold as.
        A product belongs to a kind, so it is managed here rather than on a page of its own — one
        place, one set of controls, and no second opinion about what a thing can be sold by.
      */}
      <Card className="mb-5" data-testid="kind-products">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <SectionTitle className="!mb-0.5">{t('products.title')}</SectionTitle>
            <p className="text-xs text-muted">{t('products.hint')}</p>
          </div>
          {mayManage && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingProduct(null)
                setProductOpen(true)
              }}
              data-testid="kind-product-add"
            >
              <Plus size={15} />
              {t('products.add')}
            </Button>
          )}
        </div>
        {kindProducts.length === 0 ? (
          <EmptyState icon={<Tag size={22} />} title={t('products.none')} message={t('products.noneHint')} />
        ) : (
          <div className="flex flex-col gap-2">
            {kindProducts.map((product) => (
              <div
                key={product._id}
                className="flex flex-wrap items-center gap-3 rounded-xl2 border border-line dark:border-dk-border p-3"
                data-testid={`kind-product-${product._id}`}
              >
                <div className="w-9 h-9 rounded-xl2 bg-canvas dark:bg-dk-elevated grid place-items-center text-muted">
                  <Icon name={product.emoji} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy dark:text-dk-texthi text-sm">{product.name}</p>
                  <p className="text-xs text-muted" dir="auto">
                    {product.nameAr || t('price.noProductShort')} · {billingLabel(product.billingModel, product.engineKind)}
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-sm">{money(product.basePrice)}</p>
                {!product.active && <Badge tone="neutral">{t('products.inactive')}</Badge>}
                {mayManage && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingProduct(product)
                      setProductOpen(true)
                    }}
                    data-testid={`kind-product-edit-${product._id}`}
                  >
                    {t('common:action.edit')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.units.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes size={24} />}
            title={t('empty.noUnits')}
            message={t('empty.noUnitsHint')}
            action={mayManage ? <Button onClick={openAdd}><Plus size={15} />{t('action.add')}</Button> : undefined}
          />
        </Card>
      ) : (
        <DataTable
          testId="asset-units-table"
          rows={data.units}
          keyOf={(r) => r._id}
          columns={columns}
          pageSize={10}
          initialSort={{ key: 'identifier', dir: 'asc' }}
          onRowClick={(r) => navigate(`/assets/unit/${r._id}`)}
          empty={{ title: t('empty.noUnits'), message: t('empty.noUnitsHint') }}
        />
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('add.title', { name: type.name })}
        subtitle={t('add.subtitle', { count: type.total })}
        testId="asset-detail-add-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitAdd} loading={addUnits.isPending} disabled={!stationId || !kioskId || count < 1} data-testid="asset-detail-add-submit">
              {t('add.submit', { count })}
            </Button>
          </>
        }
      >
        <Field label={t('common:field.station')} required>
          <Select
            value={stationId}
            onChange={(v) => { setStationId(v); setKioskId('') }}
            options={data.stations.map((s) => ({ label: s.name, value: s._id }))}
            testId="asset-detail-add-station"
          />
        </Field>
        <Field
          label={atAGate ? t('common:field.gate') : t('common:field.kiosk')}
          required
          hint={atAGate ? t('add.gateHint') : t('add.kioskHint')}
        >
          {placesHere.length > 0 ? (
            <Select
              value={kioskId}
              onChange={setKioskId}
              options={[
                { label: atAGate ? t('add.pickGate') : t('add.pickKiosk'), value: '' },
                ...placesHere.map((k) => ({ label: k.name, value: k._id })),
              ]}
              testId="asset-detail-add-kiosk"
            />
          ) : (
            <p className="text-xs text-danger-strong" data-testid="asset-detail-no-kiosk">
              {atAGate ? t('add.noGateHere') : t('add.noKioskHere')}
            </p>
          )}
        </Field>
        <Field label={t('add.howMany')} required hint={t('add.identifierNote')}>
          <NumberInput min={1} max={200} value={count} onChange={setCount} testId="asset-detail-add-count" />
        </Field>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('edit.title', { identifier: editing?.identifier ?? '' })}
        subtitle={t('edit.subtitle')}
        testId="asset-edit-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitEdit} loading={updateUnit.isPending} disabled={!identifier.trim()} data-testid="asset-edit-submit">
              {t('common:action.save')}
            </Button>
          </>
        }
      >
        <Field label={t('common:column.identifier')} required>
          <input className="lf-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} data-testid="asset-edit-identifier" />
        </Field>
        <Field
          label={t('common:column.status')}
          hint={editing && !SETTABLE.includes(editing.status) ? t('edit.statusLocked', { status: editing.status.replaceAll('_', ' ') }) : undefined}
        >
          <Select
            value={status}
            onChange={setStatus}
            disabled={!!editing && !SETTABLE.includes(editing.status)}
            options={SETTABLE.map((s) => ({ label: t(`status.${s}`, { defaultValue: s.replaceAll('_', ' ') }), value: s }))}
            testId="asset-edit-status"
          />
        </Field>
        <Field label={t('edit.note')}>
          <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="asset-edit-note" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('edit.station')} hint={t('edit.stationHint')}>
            <Select
              value={moveStation}
              onChange={(v) => {
                setMoveStation(v)
                setMoveKiosk('')
              }}
              options={stationsForType.map((st) => ({ label: st.name, value: st._id }))}
              disabled={!!editing && !SETTABLE.includes(editing.status)}
              testId="asset-edit-station"
            />
          </Field>
          <Field label={t('edit.desk')} hint={t('edit.deskHint')}>
            <Select
              value={moveKiosk}
              onChange={setMoveKiosk}
              options={[{ label: t('edit.noDesk'), value: '' }, ...desksForMove.map((k) => ({ label: k.name, value: k._id }))]}
              disabled={!!editing && !SETTABLE.includes(editing.status)}
              testId="asset-edit-desk"
            />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none mb-3">
          <input type="checkbox" className="mt-0.5" checked={ownPrice} onChange={(e) => setOwnPrice(e.target.checked)} data-testid="asset-edit-own-price" />
          <span>{t('edit.ownPrice', { price: type.basePrice === null ? '—' : money(type.basePrice) })}</span>
        </label>
        {ownPrice && (
          <Field label={t('edit.unitPrice')} required>
            <NumberInput min={0} step={0.5} value={unitPrice} onChange={setUnitPrice} testId="asset-edit-price" />
          </Field>
        )}
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none mb-3">
          <input type="checkbox" className="mt-0.5" checked={ownPenalty} onChange={(e) => setOwnPenalty(e.target.checked)} data-testid="asset-edit-own-penalty" />
          <span>{t('edit.ownPenalty', { price: type.penaltyPrice ? money(type.penaltyPrice) : '—' })}</span>
        </label>
        {ownPenalty && (
          <Field label={t('edit.unitPenalty')} required hint={t('edit.unitPenaltyHint')}>
            <NumberInput min={0} step={0.5} value={unitPenalty} onChange={setUnitPenalty} testId="asset-edit-penalty" />
          </Field>
        )}
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('remove.title', { identifier: removing?.identifier ?? '' })}
        subtitle={t('remove.subtitle')}
        testId="asset-remove-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>{t('common:action.cancel')}</Button>
            <Button variant="danger" onClick={submitRemove} loading={removeUnit.isPending} data-testid="asset-remove-submit">
              {t('common:action.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t('remove.body')}</p>
      </Modal>

      <KindEditorModal
        open={productOpen}
        onClose={() => setProductOpen(false)}
        kind={{
          _id: type._id,
          name: type.name,
          kind: type.kind,
          engineKind: type.engineKind,
          seats: (type.capacity?.seats as number | undefined) ?? null,
          maxRecommendedBagCount: (type.capacity?.maxRecommendedBagCount as number | undefined) ?? null,
          capacityScore: (type.capacity?.capacityScore as number | undefined) ?? null,
        }}
        product={editingProduct}
      />

      <Modal
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        title={t('price.title', { name: type.name })}
        subtitle={t('price.subtitle', { count: type.total })}
        testId="asset-detail-price-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPriceOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitPrice} loading={priceType.isPending} data-testid="asset-detail-price-submit">
              {t('price.submit')}
            </Button>
          </>
        }
      >
        {type.productId === null ? (
          <p className="text-sm text-danger-strong">{t('price.noProduct')}</p>
        ) : (
          <>
            <Field label={t('price.base')} required hint={t('price.baseHint')}>
              <NumberInput min={0} step={0.5} value={basePrice} onChange={setBasePrice} testId="asset-detail-price-base" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field label={t('price.saleUnit')} hint={t('price.saleUnitHint')}>
                <Select
                  value={saleUnit}
                  onChange={(v) => setSaleUnit(v as SaleUnit)}
                  options={SALE_UNITS.map((value) => ({ label: t(`price.unit.${value}`), value }))}
                  testId="asset-detail-price-unit"
                />
              </Field>
              <Field label={t('price.saleType')} hint={t('price.saleTypeHint')}>
                <Select
                  value={saleType}
                  onChange={(v) => setSaleType(v as SaleType)}
                  options={SALE_TYPES.map((value) => ({ label: t(`price.type.${value}`), value }))}
                  testId="asset-detail-price-type"
                />
              </Field>
            </div>
            <Field label={t('price.deposit')}>
              <NumberInput min={0} step={0.5} value={deposit} onChange={setDeposit} testId="asset-detail-price-deposit" />
            </Field>
            <Field label={t('price.penalty')} hint={t('price.penaltyHint')}>
              <NumberInput min={0} step={0.5} value={penalty} onChange={setPenalty} testId="asset-detail-price-penalty" />
            </Field>
            {saleType === 'RENTAL' && (
              <Field label={t('price.overtime')} hint={t('price.overtimeHint')}>
                <NumberInput min={0} step={0.5} value={overtime} onChange={setOvertime} testId="asset-detail-price-overtime" />
              </Field>
            )}
            <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" className="mt-0.5" checked={clearOverrides} onChange={(e) => setClearOverrides(e.target.checked)} data-testid="asset-detail-price-clear" />
              <span>{t('price.clearOverrides')}</span>
            </label>
          </>
        )}
      </Modal>

      <Modal
        open={!!freeing}
        onClose={() => setFreeing(null)}
        title={t('free.title', { identifier: freeing?.identifier ?? '' })}
        subtitle={t('free.subtitle')}
        testId="asset-free-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFreeing(null)}>{t('common:action.cancel')}</Button>
            <Button
              variant="danger"
              loading={updateUnit.isPending}
              onClick={() => { if (freeing) { quickStatus(freeing, 'AVAILABLE'); setFreeing(null) } }}
              data-testid="asset-free-submit"
            >
              {t('free.submit')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {freeing?.currentBookingRef
            ? t('free.body', { ref: freeing.currentBookingRef })
            : t('free.bodyNoBooking')}
        </p>
      </Modal>

      <AssetQrModal
        open={!!qrFor}
        onClose={() => setQrFor(null)}
        unitId={qrFor?._id ?? ''}
        identifier={qrFor?.identifier ?? ''}
        assetTypeName={type.name}
        stationName={qrFor?.stationName ?? ''}
      />
    </div>
  )
}
