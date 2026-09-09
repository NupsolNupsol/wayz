import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { useAddAssetUnits, useAssetEstate, usePriceAssetType, useRemoveAssetKind, useUpdateAssetKind } from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { engineLabel, VISIBLE_ENGINES } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'
import { NewAssetKindModal } from './NewAssetKindModal'
import { SALE_TYPES, SALE_UNITS, type AssetTypeRow, type SaleType, type SaleUnit } from '@/api/asset.api'
import type { EngineKind } from '@/api/types'

type Filter = EngineKind | 'ALL'

export function AssetsPage() {
  const { t } = useTranslation(['assets', 'common'])
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.me?.role)
  const mayManage = can(role, 'assets.manage')

  const [filter, setFilter] = useState<Filter>('ALL')
  const { data, isLoading } = useAssetEstate()
  const addUnits = useAddAssetUnits()
  const priceType = usePriceAssetType()
  const renameKind = useUpdateAssetKind()
  const removeKind = useRemoveAssetKind()

  const [newKindOpen, setNewKindOpen] = useState(false)
  const [editing, setEditing] = useState<AssetTypeRow | null>(null)
  const [newName, setNewName] = useState('')
  const [seats, setSeats] = useState(1)
  const [maxBags, setMaxBags] = useState(1)
  const [capacityScore, setCapacityScore] = useState(1)
  const [deleting, setDeleting] = useState<AssetTypeRow | null>(null)

  const [addFor, setAddFor] = useState<AssetTypeRow | null>(null)
  const [stationId, setStationId] = useState('')
  const [kioskId, setKioskId] = useState('')
  const [count, setCount] = useState(4)

  const [basePrice, setBasePrice] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [overtime, setOvertime] = useState(0)
  const [penalty, setPenalty] = useState(0)
  const [saleUnit, setSaleUnit] = useState<SaleUnit>('ITEM')
  const [saleType, setSaleType] = useState<SaleType>('RENTAL')
  const [clearOverrides, setClearOverrides] = useState(false)

  const rows = useMemo(
    () => (data?.assetTypes ?? []).filter((r) => filter === 'ALL' || r.engineKind === filter),
    [data, filter],
  )

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          inUse: acc.inUse + r.inUse,
          available: acc.available + r.available,
          outOfService: acc.outOfService + r.outOfService,
        }),
        { total: 0, inUse: 0, available: 0, outOfService: 0 },
      ),
    [rows],
  )

  const openAdd = (row: AssetTypeRow) => {
    setAddFor(row)
    // A desk that runs this activity is the only place these can live.
    const desk = (data?.kiosks ?? []).find((k) => !k.engineKind || k.engineKind === row.engineKind)
    setStationId(desk?.stationId ?? data?.stations.find((s) => s.engineKinds.includes(row.engineKind))?._id ?? data?.stations[0]?._id ?? '')
    setKioskId(desk?._id ?? '')
    setCount(4)
  }

  const desksFor = (row: AssetTypeRow | null, station: string) =>
    (data?.kiosks ?? []).filter((k) => k.stationId === station && (!k.engineKind || !row || k.engineKind === row.engineKind))

  const submitAdd = () => {
    if (!addFor) return
    addUnits.mutate(
      { id: addFor._id, body: { stationId, kioskId, count } },
      {
        onSuccess: (r) => {
          toast('success', t('toast.added', { count: r.created }), r.identifiers.slice(0, 6).join(', '))
          setAddFor(null)
        },
        onError: (e) => toast('danger', t('toast.couldNotAdd'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  /**
   * One editor for a kind.
   *
   * The name, what it holds, and what it costs were three separate dialogs behind two icons, and
   * the pencil only ever changed the name — so seats and bag ceilings could not be corrected at
   * all once a kind existed. They are all one form now.
   */
  const openEdit = (row: AssetTypeRow) => {
    setEditing(row)
    setNewName(row.name)
    setSeats(row.seats ?? 1)
    setMaxBags(row.maxRecommendedBagCount ?? 1)
    setCapacityScore(row.capacityScore ?? 1)
    setBasePrice(row.basePrice ?? 0)
    setDeposit(row.depositRequired ?? 0)
    setOvertime(row.overtimeHourlyRate ?? 0)
    setPenalty(row.penaltyPrice ?? 0)
    setSaleUnit(row.saleUnit ?? 'ITEM')
    setSaleType(row.saleType ?? 'RENTAL')
    setClearOverrides(false)
  }

  const submitEdit = async () => {
    const row = editing
    if (!row) return

    try {
      const capacity =
        row.kind === 'COMPARTMENT'
          ? { maxRecommendedBagCount: Math.max(1, maxBags), capacityScore: Math.max(0, capacityScore) }
          : row.kind === 'BOAT'
            ? { seats: Math.max(1, seats), capacityScore: Math.max(1, seats) }
            : { capacityScore: Math.max(0, capacityScore) }

      await renameKind.mutateAsync({ id: row._id, body: { name: newName.trim(), capacity } })

      // A kind with no product behind it has nothing to price.
      if (row.productId) {
        const priced = await priceType.mutateAsync({
          id: row._id,
          body: {
            basePrice,
            depositRequired: deposit,
            penaltyPrice: penalty,
            saleUnit,
            saleType,
            overtimeHourlyRate: saleType === 'SALE' ? null : overtime || null,
            clearOverrides,
          },
        })
        toast(
          'success',
          t('toast.kindSaved', { name: newName.trim() }),
          priced.cleared ? t('toast.overridesCleared', { count: priced.cleared }) : t('toast.appliesToAll'),
        )
      } else {
        toast('success', t('toast.kindSaved', { name: newName.trim() }))
      }
      setEditing(null)
    } catch (e) {
      toast('danger', t('toast.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    }
  }

  const submitDelete = () => {
    if (!deleting) return
    removeKind.mutate(deleting._id, {
      onSuccess: (r) => {
        toast('warning', t('toast.kindRemoved', { name: r.name }))
        setDeleting(null)
      },
      onError: (e) => toast('danger', t('toast.couldNotRemoveKind'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
    })
  }

  const columns: Column<AssetTypeRow>[] = [
    {
      key: 'name',
      header: t('common:column.name'),
      sortValue: (r) => r.name,
      filter: { kind: 'text', value: (r) => `${r.name} ${r.kind}` },
      render: (r) => (
        <div className="min-w-0 max-w-[220px]">
          <p className="font-semibold text-navy dark:text-dk-texthi truncate">{r.name}</p>
          <p className="text-xs text-muted truncate" title={r.stationNames.join(' · ')}>
            {t(`kind.${r.kind}`, { defaultValue: r.kind })}
            {' · '}
            {r.stationNames.length === 0
              ? t('table.noStation')
              : r.stationNames.length === 1
                ? r.stationNames[0]
                : t('table.stationsMore', { first: r.stationNames[0], count: r.stationNames.length - 1 })}
          </p>
        </div>
      ),
    },
    {
      key: 'engine',
      header: t('common:column.activity'),
      sortValue: (r) => r.engineKind,
      filter: { kind: 'select', options: VISIBLE_ENGINES.map((k) => ({ label: engineLabel(k), value: k })), value: (r) => r.engineKind },
      render: (r) => <span className="text-muted whitespace-nowrap">{engineLabel(r.engineKind)}</span>,
    },
    {
      key: 'total',
      header: t('common:column.total'),
      align: 'right',
      sortValue: (r) => r.total,
      render: (r) => <span className="tabular-nums font-semibold">{r.total}</span>,
    },
    {
      key: 'inUse',
      header: t('table.inUse'),
      align: 'right',
      sortValue: (r) => r.inUse,
      render: (r) => <span className="tabular-nums">{r.inUse}</span>,
    },
    {
      key: 'available',
      header: t('table.free'),
      align: 'right',
      sortValue: (r) => r.available,
      render: (r) => <span className="tabular-nums text-success font-medium">{r.available}</span>,
    },
    {
      key: 'down',
      header: t('table.down'),
      align: 'right',
      sortValue: (r) => r.outOfService,
      render: (r) => (
        <span className={clsx('tabular-nums', r.outOfService ? 'text-danger-strong font-medium' : 'text-muted')}>
          {r.outOfService}
        </span>
      ),
    },
    {
      key: 'utilisation',
      header: t('table.utilisation'),
      align: 'right',
      sortValue: (r) => r.utilisationPct,
      render: (r) => (
        <Badge tone={r.utilisationPct > 80 ? 'danger' : r.utilisationPct > 50 ? 'warning' : 'success'}>
          {r.utilisationPct}%
        </Badge>
      ),
    },
    {
      key: 'price',
      header: t('table.price'),
      align: 'right',
      sortValue: (r) => r.basePrice ?? -1,
      render: (r) =>
        r.basePrice === null ? (
          <span className="text-muted">—</span>
        ) : (
          <div className="text-end">
            <span className="tabular-nums whitespace-nowrap">{money(r.basePrice)}</span>
            {r.saleUnit && (
              <p className="text-[11px] text-muted whitespace-nowrap">
                {t(`price.unit.${r.saleUnit}`)} · {t(`price.type.${r.saleType ?? 'RENTAL'}`)}
              </p>
            )}
          </div>
        ),
    },
    {
      key: 'penalty',
      header: t('table.penalty'),
      align: 'right',
      sortValue: (r) => r.penaltyPrice ?? -1,
      render: (r) =>
        r.penaltyPrice ? (
          <span className="tabular-nums whitespace-nowrap">{money(r.penaltyPrice)}</span>
        ) : (
          <span className="text-muted">—</span>
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
          <Button
            variant="ghost"
            onClick={() => openEdit(r)}
            title={t('action.editKind')}
            aria-label={t('action.editKind')}
            data-testid={`asset-edit-${r._id}`}
          >
            <Pencil size={15} />
          </Button>
          {r.total === 0 && (
            <Button
              variant="ghost"
              onClick={() => setDeleting(r)}
              title={t('action.deleteKind')}
              aria-label={t('action.deleteKind')}
              data-testid={`asset-delete-kind-${r._id}`}
            >
              <Trash2 size={15} />
            </Button>
          )}
          <Button variant="secondary" onClick={() => openAdd(r)} title={t('action.add')} aria-label={t('action.add')} data-testid={`asset-add-${r._id}`}>
            <Plus size={15} />
          </Button>
        </div>
      ),
    })
  }

  if (isLoading || !data) {
    return (
      <div data-testid="assets-page">
        <PageHeader title={t('title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  return (
    <div data-testid="assets-page">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        helpId="assets"
        crumbs={[{ label: t('common:crumb.assets') }]}
        actions={
          mayManage ? (
            <Button onClick={() => setNewKindOpen(true)} data-testid="asset-new-kind">
              <Plus size={16} />{t('action.newKind')}</Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t('table.total')} value={totals.total} icon={<Boxes size={18} />} testId="asset-stat-total" />
        <StatCard label={t('table.inUse')} value={totals.inUse} tone="info" testId="asset-stat-inuse" />
        <StatCard label={t('table.free')} value={totals.available} tone="success" testId="asset-stat-free" />
        <StatCard label={t('table.down')} value={totals.outOfService} tone={totals.outOfService ? 'danger' : 'neutral'} testId="asset-stat-down" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4" data-testid="asset-engine-filters">
        <FilterButton active={filter === 'ALL'} onClick={() => setFilter('ALL')} testId="asset-filter-ALL">
          {t('common:table.all')}
        </FilterButton>
        {VISIBLE_ENGINES.map((kind) => (
          <FilterButton key={kind} active={filter === kind} onClick={() => setFilter(kind)} testId={`asset-filter-${kind}`}>
            {engineLabel(kind)}
          </FilterButton>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes size={24} />}
            title={t('empty.title')}
            message={t('empty.message')}
            action={
              mayManage ? (
                <Button onClick={() => setNewKindOpen(true)} data-testid="asset-new-kind-empty">
                  <Plus size={15} />{t('action.newKind')}</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <DataTable
          testId="asset-types-table"
          rows={rows}
          keyOf={(r) => r._id}
          columns={columns}
          pageSize={12}
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={(r) => navigate(`/assets/${r._id}`)}
          empty={{ title: t('empty.title'), message: t('empty.message') }}
        />
      )}

      <NewAssetKindModal
        open={newKindOpen}
        onClose={() => setNewKindOpen(false)}
        stations={data.stations}
        kiosks={data.kiosks ?? []}
        defaultEngine={filter === 'ALL' ? undefined : filter}
        onCreated={(id) => navigate(`/assets/${id}`)}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('editKind.title', { name: editing?.name ?? '' })}
        subtitle={t('editKind.subtitle')}
        size="lg"
        testId="asset-edit-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>{t('common:action.cancel')}</Button>
            <Button
              onClick={submitEdit}
              loading={renameKind.isPending || priceType.isPending}
              disabled={newName.trim().length < 2}
              data-testid="asset-edit-submit"
            >
              {t('common:action.save')}
            </Button>
          </>
        }
      >
        <SectionTitle className="mb-2">{t('editKind.details')}</SectionTitle>
        <Field label={t('common:field.name')} required>
          <input className="lf-input" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="asset-edit-name" />
        </Field>

        {editing?.kind === 'BOAT' && (
          <Field label={t('editKind.seats')} hint={t('editKind.seatsHint')}>
            <NumberInput min={1} step={1} value={seats} onChange={setSeats} testId="asset-edit-seats" />
          </Field>
        )}

        {editing?.kind === 'COMPARTMENT' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label={t('editKind.maxBags')} hint={t('editKind.maxBagsHint')}>
              <NumberInput min={1} step={1} value={maxBags} onChange={setMaxBags} testId="asset-edit-max-bags" />
            </Field>
            <Field label={t('editKind.capacityScore')} hint={t('editKind.capacityScoreHint')}>
              <NumberInput min={0} step={1} value={capacityScore} onChange={setCapacityScore} testId="asset-edit-capacity" />
            </Field>
          </div>
        )}

        <SectionTitle className="mb-2 mt-5">{t('editKind.pricing')}</SectionTitle>
        {editing && editing.productId === null ? (
          <p className="text-sm text-danger-strong" data-testid="asset-edit-no-product">{t('price.noProduct')}</p>
        ) : (
          <>
            <Field label={t('price.base')} required hint={t('price.baseHint')}>
              <NumberInput min={0} step={0.5} value={basePrice} onChange={setBasePrice} testId="asset-edit-base" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field label={t('price.saleUnit')} hint={t('price.saleUnitHint')}>
                <Select
                  value={saleUnit}
                  onChange={(v) => setSaleUnit(v as SaleUnit)}
                  options={SALE_UNITS.map((value) => ({ label: t(`price.unit.${value}`), value }))}
                  testId="asset-edit-sale-unit"
                />
              </Field>
              <Field label={t('price.saleType')} hint={t('price.saleTypeHint')}>
                <Select
                  value={saleType}
                  onChange={(v) => setSaleType(v as SaleType)}
                  options={SALE_TYPES.map((value) => ({ label: t(`price.type.${value}`), value }))}
                  testId="asset-edit-sale-type"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field label={t('price.deposit')}>
                <NumberInput min={0} step={0.5} value={deposit} onChange={setDeposit} testId="asset-edit-deposit" />
              </Field>
              <Field label={t('price.penalty')} hint={t('price.penaltyHint')}>
                <NumberInput min={0} step={0.5} value={penalty} onChange={setPenalty} testId="asset-edit-penalty" />
              </Field>
            </div>
            {saleType !== 'SALE' && (
              <Field label={t('price.overtime')} hint={t('price.overtimeHint')}>
                <NumberInput min={0} step={0.5} value={overtime} onChange={setOvertime} testId="asset-edit-overtime" />
              </Field>
            )}
            <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={clearOverrides}
                onChange={(e) => setClearOverrides(e.target.checked)}
                data-testid="asset-edit-clear-overrides"
              />
              <span>{t('price.clearOverrides')}</span>
            </label>
          </>
        )}
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('removeKind.title', { name: deleting?.name ?? '' })}
        subtitle={t('removeKind.subtitle')}
        testId="asset-delete-kind-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common:action.cancel')}</Button>
            <Button variant="danger" onClick={submitDelete} loading={removeKind.isPending} data-testid="asset-delete-kind-submit">
              {t('common:action.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t('removeKind.body')}</p>
      </Modal>

      <Modal
        open={!!addFor}
        onClose={() => setAddFor(null)}
        title={t('add.title', { name: addFor?.name ?? '' })}
        subtitle={t('add.subtitle', { count: addFor?.total ?? 0 })}
        testId="asset-add-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddFor(null)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitAdd} loading={addUnits.isPending} disabled={!stationId || !kioskId || count < 1} data-testid="asset-add-submit">
              {t('add.submit', { count })}
            </Button>
          </>
        }
      >
        <Field label={t('common:field.station')} required>
          <Select
            value={stationId}
            onChange={(v) => {
              setStationId(v)
              setKioskId(desksFor(addFor, v)[0]?._id ?? '')
            }}
            options={data.stations.map((s) => ({ label: s.name, value: s._id }))}
            testId="asset-add-station"
          />
        </Field>
        <Field label={t('common:field.kiosk')} required hint={t('add.kioskHint')}>
          {desksFor(addFor, stationId).length > 0 ? (
            <Select
              value={kioskId}
              onChange={setKioskId}
              options={[
                { label: t('add.pickKiosk'), value: '' },
                ...desksFor(addFor, stationId).map((k) => ({ label: k.name, value: k._id })),
              ]}
              testId="asset-add-kiosk"
            />
          ) : (
            <p className="text-xs text-danger-strong" data-testid="asset-add-no-kiosk">{t('add.noKioskHere')}</p>
          )}
        </Field>
        <Field label={t('add.howMany')} required hint={t('add.identifierNote')}>
          <NumberInput min={1} max={200} value={count} onChange={setCount} testId="asset-add-count" />
        </Field>
      </Modal>

    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  testId: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-active={active ? 'yes' : 'no'}
      className={clsx(
        'px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors',
        active
          ? 'bg-brand text-white border-brand'
          : 'bg-white text-muted border-line hover:border-brand hover:text-brand dark:bg-dk-elevated dark:border-dk-border',
      )}
    >
      {children}
    </button>
  )
}
