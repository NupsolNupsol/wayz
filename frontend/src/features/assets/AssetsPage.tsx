import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, Spinner, StatCard } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { useAddAssetUnits, useAssetEstate, useManagerPricing, useRemoveAssetKind } from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { engineLabel, VISIBLE_ENGINES } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'
import { NewAssetKindModal } from './NewAssetKindModal'
import { KindEditorModal } from './KindEditorModal'
import type { PricingProduct } from '@/api/manager.api'
import { type AssetTypeRow } from '@/api/asset.api'
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
  const removeKind = useRemoveAssetKind()

  const [newKindOpen, setNewKindOpen] = useState(false)
  const [editing, setEditing] = useState<AssetTypeRow | null>(null)
  const [deleting, setDeleting] = useState<AssetTypeRow | null>(null)

  const [addFor, setAddFor] = useState<AssetTypeRow | null>(null)
  const [stationId, setStationId] = useState('')
  const [kioskId, setKioskId] = useState('')
  const [count, setCount] = useState(4)


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

  /**
   * Where a kind of asset can be put, which depends on what it is.
   *
   * Lockers stand in a gate and everything else at a desk — a Shop & Drop counter holds no
   * compartments at all, so offering one here would create stock nothing could ever reach. The
   * server enforces the same rule; this is the form agreeing with it.
   */
  const atAGate = (row: AssetTypeRow | null) => row?.kind === 'COMPARTMENT'

  const desksFor = (row: AssetTypeRow | null, station: string) =>
    atAGate(row)
      ? (data?.gates ?? []).filter((g) => g.stationId === station)
      : (data?.kiosks ?? []).filter(
          (k) => k.stationId === station && (!k.engineKind || !row || k.engineKind === row.engineKind),
        )

  const submitAdd = () => {
    if (!addFor) return
    addUnits.mutate(
      { id: addFor._id, body: { stationId, ...(atAGate(addFor) ? { gateId: kioskId } : { kioskId }), count } },
      {
        onSuccess: (r) => {
          toast('success', t('toast.added', { count: r.created }), r.identifiers.slice(0, 6).join(', '))
          setAddFor(null)
        },
        onError: (e) => toast('danger', t('toast.couldNotAdd'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const pricing = useManagerPricing()

  /**
   * One editor for a kind, opened from two places.
   *
   * The name, what it holds and what it costs used to be spread over separate dialogs, and the
   * estate list and the kind's own page each had their own version of the form. Both open this
   * one now; it reads the kind and its product for itself rather than being handed a copy.
   */
  const openEdit = (row: AssetTypeRow) => setEditing(row)

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
          {/*
            When a kind stands in more than one venue, say how many rather than naming the first.

            The total on this row is everything the company owns, across every venue. Naming one
            station beside it read as "this station has all of these" — and the "+1" that said
            otherwise was the first thing the truncation ate, because venue names are long. A
            count cannot be truncated into a different meaning; the names are still in the tooltip.
          */}
          <p className="text-xs text-muted truncate" title={r.stationNames.join(' · ')}>
            {t(`kind.${r.kind}`, { defaultValue: r.kind })}
            {' · '}
            {r.stationNames.length === 0
              ? t('table.noStation')
              : r.stationNames.length === 1
                ? r.stationNames[0]
                : t('table.acrossStations', { count: r.stationNames.length })}
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
          search={{
            // A long estate is the normal case, so the name is not the only way in: an agent looks
            // for "compartment", "boat", "lagoon" or the kind's own name and expects all of them.
            of: (r) => `${r.name} ${r.kind} ${engineLabel(r.engineKind)} ${r.productName ?? ''}`,
            placeholder: t('table.findKind'),
          }}
          onRowClick={(r) => navigate(`/assets/${r._id}`)}
          empty={{ title: t('empty.title'), message: t('empty.message') }}
        />
      )}

      <NewAssetKindModal
        open={newKindOpen}
        onClose={() => setNewKindOpen(false)}
        stations={data.stations}
        kiosks={data.kiosks ?? []}
        gates={data.gates ?? []}
        defaultEngine={filter === 'ALL' ? undefined : filter}
        onCreated={(id) => navigate(`/assets/${id}`)}
      />

      <KindEditorModal
        open={!!editing}
        onClose={() => setEditing(null)}
        kind={editing}
        product={editing ? (pricing.data?.products ?? []).find((pr: PricingProduct) => pr.assetTypeId === editing._id) ?? null : null}
      />

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
        <Field
          label={atAGate(addFor) ? t('common:field.gate') : t('common:field.kiosk')}
          required
          hint={atAGate(addFor) ? t('add.gateHint') : t('add.kioskHint')}
        >
          {desksFor(addFor, stationId).length > 0 ? (
            <Select
              value={kioskId}
              onChange={setKioskId}
              options={[
                { label: atAGate(addFor) ? t('add.pickGate') : t('add.pickKiosk'), value: '' },
                ...desksFor(addFor, stationId).map((k) => ({ label: k.name, value: k._id })),
              ]}
              testId="asset-add-kiosk"
            />
          ) : (
            <p className="text-xs text-danger-strong" data-testid="asset-add-no-kiosk">
              {atAGate(addFor) ? t('add.noGateHere') : t('add.noKioskHere')}
            </p>
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
