import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Boxes, Pencil, Plus, QrCode, Tag, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, Spinner, StatCard, StatusBadge } from '@/components/ui'
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
import { engineLabel } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'
import type { AssetUnitRow } from '@/api/asset.api'

/** The statuses a person may set by hand; the rest are moved by the booking workflow. */
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

  const [qrFor, setQrFor] = useState<AssetUnitRow | null>(null)
  const [removing, setRemoving] = useState<AssetUnitRow | null>(null)
  const [freeing, setFreeing] = useState<AssetUnitRow | null>(null)

  const [priceOpen, setPriceOpen] = useState(false)
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
  const kiosksHere = data.kiosks.filter((k) => k.stationId === stationId)

  const openAdd = () => {
    setStationId(data.stations.find((s) => s.engineKinds.includes(type.engineKind))?._id ?? data.stations[0]?._id ?? '')
    setKioskId('')
    setCount(4)
    setAddOpen(true)
  }

  const submitAdd = () => {
    addUnits.mutate(
      { id, body: { stationId, kioskId: kioskId || null, count } },
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

  const openPrice = () => {
    setBasePrice(type.basePrice ?? 0)
    setDeposit(type.depositRequired ?? 0)
    setOvertime(type.overtimeHourlyRate ?? 0)
    setClearOverrides(false)
    setPriceOpen(true)
  }

  const submitPrice = () => {
    priceType.mutate(
      { id, body: { basePrice, depositRequired: deposit, overtimeHourlyRate: overtime || null, clearOverrides } },
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
            <Button onClick={submitAdd} loading={addUnits.isPending} disabled={!stationId || count < 1} data-testid="asset-detail-add-submit">
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
        {kiosksHere.length > 0 && (
          <Field label={t('common:field.kiosk')} hint={t('add.kioskHint')}>
            <Select
              value={kioskId}
              onChange={setKioskId}
              options={[{ label: t('add.noKiosk'), value: '' }, ...kiosksHere.map((k) => ({ label: k.name, value: k._id }))]}
              testId="asset-detail-add-kiosk"
            />
          </Field>
        )}
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
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none mb-3">
          <input type="checkbox" className="mt-0.5" checked={ownPrice} onChange={(e) => setOwnPrice(e.target.checked)} data-testid="asset-edit-own-price" />
          <span>{t('edit.ownPrice', { price: type.basePrice === null ? '—' : money(type.basePrice) })}</span>
        </label>
        {ownPrice && (
          <Field label={t('edit.unitPrice')} required>
            <NumberInput min={0} step={0.5} value={unitPrice} onChange={setUnitPrice} testId="asset-edit-price" />
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
            <Field label={t('price.deposit')}>
              <NumberInput min={0} step={0.5} value={deposit} onChange={setDeposit} testId="asset-detail-price-deposit" />
            </Field>
            <Field label={t('price.overtime')} hint={t('price.overtimeHint')}>
              <NumberInput min={0} step={0.5} value={overtime} onChange={setOvertime} testId="asset-detail-price-overtime" />
            </Field>
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
