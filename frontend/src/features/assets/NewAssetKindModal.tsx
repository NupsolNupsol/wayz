import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/Modal'
import { Button, Field, FieldGroupTitle } from '@/components/ui'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { useCreateAssetKind } from '@/hooks'
import { engineLabel, VISIBLE_ENGINES } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { ASSET_KINDS, SALE_TYPES, SALE_UNITS, type AssetKind, type AssetStation, type SaleType, type SaleUnit } from '@/api/asset.api'
import type { EngineKind } from '@/api/types'

const KIND_ENGINE: Record<AssetKind, EngineKind> = {
  COMPARTMENT: 'SHOP_AND_DROP',
  VEHICLE: 'MOBILITY',
  BOAT: 'LAGOON',
  TABLE: 'COTE_RESTAURANT',
  ANIMAL: 'ANAAM',
}

const VISIBLE_KINDS: AssetKind[] = ['COMPARTMENT', 'VEHICLE', 'BOAT']

export function NewAssetKindModal({
  open,
  onClose,
  stations,
  defaultEngine,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  stations: AssetStation[]
  defaultEngine?: EngineKind
  onCreated?: (id: string) => void
}) {
  const { t } = useTranslation(['assets', 'common'])
  const create = useCreateAssetKind()

  const [kind, setKind] = useState<AssetKind>('COMPARTMENT')
  const [engineKind, setEngineKind] = useState<EngineKind>(defaultEngine ?? 'SHOP_AND_DROP')
  const [name, setName] = useState('')
  const [basePrice, setBasePrice] = useState(25)
  const [deposit, setDeposit] = useState(0)
  const [overtime, setOvertime] = useState(0)
  const [penalty, setPenalty] = useState(0)
  const [saleUnit, setSaleUnit] = useState<SaleUnit>('ITEM')
  const [saleType, setSaleType] = useState<SaleType>('RENTAL')

  const [w, setW] = useState(40)
  const [h, setH] = useState(40)
  const [d, setD] = useState(60)
  const [maxWeight, setMaxWeight] = useState(25)
  const [bagCount, setBagCount] = useState(2)
  const [seats, setSeats] = useState(2)

  const [stationId, setStationId] = useState('')
  const [initialCount, setInitialCount] = useState(4)

  useEffect(() => {
    if (!open) return
    const startingKind: AssetKind = defaultEngine
      ? ((ASSET_KINDS.find((k) => KIND_ENGINE[k] === defaultEngine) as AssetKind | undefined) ?? 'COMPARTMENT')
      : 'COMPARTMENT'
    setKind(startingKind)
    setEngineKind(defaultEngine ?? KIND_ENGINE[startingKind])
    setName('')
    setBasePrice(25)
    setDeposit(0)
    setOvertime(0)
    setStationId(stations[0]?._id ?? '')
    setInitialCount(4)
  }, [open, defaultEngine, stations])

  const pickKind = (next: AssetKind) => {
    setKind(next)
    setEngineKind(KIND_ENGINE[next])
  }

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        engineKind,
        kind,
        basePrice,
        saleUnit,
        saleType,
        depositRequired: deposit,
        penaltyPrice: penalty,
        overtimeHourlyRate: saleType === 'SALE' ? null : overtime || null,
        capacity:
          kind === 'COMPARTMENT'
            ? { internalDimensions: { w, h, d }, maxWeight, maxRecommendedBagCount: bagCount, capacityScore: bagCount }
            : { seats, capacityScore: seats },
        ...(initialCount > 0 && stationId ? { initialCount, stationId } : {}),
      },
      {
        onSuccess: (r) => {
          toast(
            'success',
            t('toast.kindCreated', { name: r.name }),
            r.provisioned ? t('toast.kindProvisioned', { count: r.provisioned }) : t('toast.kindNoUnits'),
          )
          onClose()
          onCreated?.(r._id)
        },
        onError: (e) =>
          toast('danger', t('toast.couldNotCreateKind'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('newKind.title')}
      subtitle={t('newKind.subtitle')}
      size="lg"
      testId="asset-new-kind-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:action.cancel')}</Button>
          <Button
            onClick={submit}
            loading={create.isPending}
            disabled={name.trim().length < 2}
            data-testid="asset-new-kind-submit"
          >
            {t('newKind.submit')}
          </Button>
        </>
      }
    >
      <Field label={t('newKind.shape')} required hint={t('newKind.shapeHint')}>
        <div className="flex flex-wrap gap-2">
          {VISIBLE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pickKind(k)}
              data-testid={`asset-new-kind-${k}`}
              data-active={kind === k ? 'yes' : 'no'}
              className={
                kind === k
                  ? 'px-3.5 py-1.5 rounded-full text-sm font-semibold border bg-brand text-white border-brand'
                  : 'px-3.5 py-1.5 rounded-full text-sm font-semibold border bg-white text-muted border-line hover:border-brand hover:text-brand dark:bg-dk-elevated dark:border-dk-border'
              }
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('common:field.name')} required hint={t('newKind.nameHint')}>
        <input
          className="lf-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('newKind.namePlaceholder')}
          data-testid="asset-new-kind-name"
        />
      </Field>

      <Field label={t('common:column.activity')} required>
        <Select
          value={engineKind}
          onChange={(v) => setEngineKind(v as EngineKind)}
          options={VISIBLE_ENGINES.map((k) => ({ label: engineLabel(k), value: k }))}
          testId="asset-new-kind-engine"
        />
      </Field>

      <FieldGroupTitle>{t('newKind.pricing')}</FieldGroupTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('price.saleUnit')} required hint={t('price.saleUnitHint')}>
          <Select
            value={saleUnit}
            onChange={(v) => setSaleUnit(v as SaleUnit)}
            options={SALE_UNITS.map((value) => ({ label: t(`price.unit.${value}`), value }))}
            testId="asset-new-kind-sale-unit"
          />
        </Field>
        <Field label={t('price.saleType')} required hint={t('price.saleTypeHint')}>
          <Select
            value={saleType}
            onChange={(v) => setSaleType(v as SaleType)}
            options={SALE_TYPES.map((value) => ({ label: t(`price.type.${value}`), value }))}
            testId="asset-new-kind-sale-type"
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Field label={t('price.base')} required>
          <NumberInput min={0} step={0.5} value={basePrice} onChange={setBasePrice} testId="asset-new-kind-price" />
        </Field>
        <Field label={t('price.deposit')}>
          <NumberInput min={0} step={0.5} value={deposit} onChange={setDeposit} testId="asset-new-kind-deposit" />
        </Field>
        <Field label={t('price.penalty')}>
          <NumberInput min={0} step={0.5} value={penalty} onChange={setPenalty} testId="asset-new-kind-penalty" />
        </Field>
        {saleType === 'RENTAL' && (
          <Field label={t('price.overtime')}>
            <NumberInput min={0} step={0.5} value={overtime} onChange={setOvertime} testId="asset-new-kind-overtime" />
          </Field>
        )}
      </div>

      <FieldGroupTitle>{t('newKind.capacity')}</FieldGroupTitle>
      {kind === 'COMPARTMENT' ? (
        <>
          <Field label={t('newKind.dimensions')} hint={t('newKind.dimensionsHint')}>
            <div className="flex items-center gap-2">
              <NumberInput min={1} value={w} onChange={setW} testId="asset-new-kind-w" />
              <NumberInput min={1} value={h} onChange={setH} testId="asset-new-kind-h" />
              <NumberInput min={1} value={d} onChange={setD} testId="asset-new-kind-d" />
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('newKind.maxWeight')}>
              <NumberInput min={0} value={maxWeight} onChange={setMaxWeight} testId="asset-new-kind-weight" />
            </Field>
            <Field label={t('newKind.bagCount')} hint={t('newKind.bagCountHint')}>
              <NumberInput min={1} value={bagCount} onChange={setBagCount} testId="asset-new-kind-bags" />
            </Field>
          </div>
        </>
      ) : (
        <Field label={t('newKind.seats')} hint={t('newKind.seatsHint')}>
          <NumberInput min={1} value={seats} onChange={setSeats} testId="asset-new-kind-seats" />
        </Field>
      )}

      <FieldGroupTitle>{t('newKind.firstAssets')}</FieldGroupTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('common:field.station')}>
          <Select
            value={stationId}
            onChange={setStationId}
            options={stations.map((s) => ({ label: s.name, value: s._id }))}
            testId="asset-new-kind-station"
          />
        </Field>
        <Field label={t('newKind.howMany')} hint={t('newKind.howManyHint')}>
          <NumberInput min={0} max={200} value={initialCount} onChange={setInitialCount} testId="asset-new-kind-count" />
        </Field>
      </div>
    </Modal>
  )
}
