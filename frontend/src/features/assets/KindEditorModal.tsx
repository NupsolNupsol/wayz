import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Modal } from '@/components/Modal'
import { Button, Field, FieldGroupTitle } from '@/components/ui'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { Icon } from '@/components/Icon'
import { useCreateProduct, usePriceAssetType, useUpdateAssetKind, useUpdateProduct } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import {
  PRODUCT_ICONS,
  billingForSaleUnit,
  billingLabel,
  chargesForTime,
  defaultSaleUnitFor,
  saleUnitsFor,
} from '@/config/engineMeta'
import { SALE_TYPES, SALE_UNITS, type SaleType, type SaleUnit } from '@/api/asset.api'
import type { EngineKind } from '@/api/types'
import type { PricingProduct } from '@/api/manager.api'

/** The physical thing: what it is called and what it holds. */
export interface EditableKind {
  _id: string
  name: string
  kind: string
  engineKind: EngineKind
  seats?: number | null
  maxRecommendedBagCount?: number | null
  capacityScore?: number | null
}

/**
 * One editor for a kind and what it is sold as.
 *
 * There used to be two: a "rename" dialog on the estate list that had quietly grown a price on it,
 * and a product form on the kind's own page. They asked overlapping questions with different
 * wording and different controls, so the same figure could be set in two places and an admin had
 * to know which screen to trust. This is both halves, in one shape, wherever it is opened from.
 *
 * Billing is never asked for. How a thing is charged follows from how it is sold, and the two
 * drifting apart is what makes a two-hour hire cost the same as a one-hour one.
 */
export function KindEditorModal({
  open,
  onClose,
  kind,
  product,
}: {
  open: boolean
  onClose: () => void
  kind: EditableKind | null
  /** What it is sold as, or null to put a new product on this kind. */
  product: PricingProduct | null
}) {
  const { t } = useTranslation(['assets', 'common'])
  const renameKind = useUpdateAssetKind()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const priceType = usePriceAssetType()

  const [name, setName] = useState('')
  const [seats, setSeats] = useState(1)
  const [maxBags, setMaxBags] = useState(1)
  const [capacityScore, setCapacityScore] = useState(1)

  const [productName, setProductName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [emoji, setEmoji] = useState('Package')
  const [category, setCategory] = useState('General')
  const [saleUnit, setSaleUnit] = useState<SaleUnit>('HOUR')
  const [saleType, setSaleType] = useState<SaleType>('RENTAL')
  const [basePrice, setBasePrice] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [penalty, setPenalty] = useState(0)
  const [overtime, setOvertime] = useState(0)
  const [tourPrice, setTourPrice] = useState(0)
  const [tourMinutes, setTourMinutes] = useState(60)
  const [active, setActive] = useState(true)
  const [clearOverrides, setClearOverrides] = useState(false)

  /*
   * Opening is the only moment this form reads from anywhere else — and it reads the record, not a
   * set of defaults. A form that opens on defaults writes them back the moment somebody saves, so
   * an admin fixing a typo would silently reset how the thing is sold.
   */
  useEffect(() => {
    if (!open || !kind) return
    setName(kind.name)
    setSeats(kind.seats ?? 1)
    setMaxBags(kind.maxRecommendedBagCount ?? 1)
    setCapacityScore(kind.capacityScore ?? 1)

    setProductName(product?.name ?? kind.name)
    setNameAr(product?.nameAr ?? '')
    setEmoji(product?.emoji ?? 'Package')
    setCategory(product?.category ?? kind.name)
    setSaleUnit(product?.saleUnit ?? (defaultSaleUnitFor(kind.engineKind, SALE_UNITS) as SaleUnit))
    setSaleType(product?.saleType ?? 'RENTAL')
    setBasePrice(product?.basePrice ?? 0)
    setDeposit(product?.depositRequired ?? 0)
    setPenalty(product?.penaltyPrice ?? 0)
    setOvertime(product?.overtimeHourlyRate ?? 0)
    setTourPrice(product?.tourPrice ?? 0)
    setTourMinutes(product?.tourMinutes ?? 60)
    setActive(product?.active ?? true)
    setClearOverrides(false)
  }, [open, kind, product])

  if (!kind) return null

  const billing = billingForSaleUnit(saleUnit, kind.kind)
  const soldByTour = saleUnit === 'TOUR'
  const keepsTime = chargesForTime(kind.engineKind) && saleType === 'RENTAL'
  const busy = renameKind.isPending || createProduct.isPending || updateProduct.isPending || priceType.isPending

  const submit = async () => {
    try {
      const capacity =
        kind.kind === 'COMPARTMENT'
          ? { maxRecommendedBagCount: Math.max(1, maxBags), capacityScore: Math.max(0, capacityScore) }
          : kind.kind === 'BOAT'
            ? { seats: Math.max(1, seats), capacityScore: Math.max(1, seats) }
            : { capacityScore: Math.max(0, capacityScore) }

      await renameKind.mutateAsync({ id: kind._id, body: { name: name.trim(), capacity } })

      const body = {
        name: productName.trim() || name.trim(),
        nameAr: nameAr.trim() || undefined,
        emoji,
        engineKind: kind.engineKind,
        category: category.trim() || name.trim(),
        basePrice,
        // Not asked for here, so an edit leaves whatever is already set rather than clearing it.
        hourlyPrice: product ? product.hourlyPrice : null,
        tourPrice: soldByTour ? tourPrice : null,
        tourMinutes: soldByTour ? tourMinutes : null,
        saleUnit,
        saleType,
        // Sold by the hour means charged by the hour; a stale unit is how a day's hire is billed
        // as an hour.
        ...(saleUnit === 'HOUR' ? { durationUnit: 'HOUR' as const } : {}),
        ...(saleUnit === 'FULL_DAY' ? { durationUnit: 'DAY' as const } : {}),
        overtimeHourlyRate: keepsTime ? overtime || null : null,
        depositRequired: deposit,
        penaltyPrice: penalty,
        assetTypeId: kind._id,
        billingModel: billing,
        active,
      }

      if (product) await updateProduct.mutateAsync({ id: product._id, patch: body })
      else await createProduct.mutateAsync(body)

      // A single asset can carry its own price; clearing brings the whole kind back into line.
      if (clearOverrides) {
        const cleared = await priceType.mutateAsync({ id: kind._id, body: { clearOverrides: true } })
        if (cleared.cleared) toast('info', t('toast.overridesCleared', { count: cleared.cleared }))
      }

      toast('success', t('toast.kindSaved', { name: name.trim() }))
      onClose()
    } catch (e) {
      toast('danger', t('toast.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('editKind.title', { name: kind.name })}
      subtitle={t('editKind.subtitle')}
      size="lg"
      testId="asset-edit-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common:action.cancel')}</Button>
          <Button onClick={() => void submit()} loading={busy} disabled={name.trim().length < 2} data-testid="asset-edit-submit">
            {t('common:action.save')}
          </Button>
        </>
      }
    >
      <FieldGroupTitle>{t('editKind.details')}</FieldGroupTitle>
      <Field label={t('common:field.name')} required>
        <input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} data-testid="asset-edit-name" />
      </Field>

      {kind.kind === 'BOAT' && (
        <Field label={t('editKind.seats')} hint={t('editKind.seatsHint')}>
          <NumberInput min={1} step={1} value={seats} onChange={setSeats} testId="asset-edit-seats" />
        </Field>
      )}

      {kind.kind === 'COMPARTMENT' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('editKind.maxBags')} hint={t('editKind.maxBagsHint')}>
            <NumberInput min={1} step={1} value={maxBags} onChange={setMaxBags} testId="asset-edit-max-bags" />
          </Field>
          <Field label={t('editKind.capacityScore')} hint={t('editKind.capacityScoreHint')}>
            <NumberInput min={0} step={1} value={capacityScore} onChange={setCapacityScore} testId="asset-edit-capacity" />
          </Field>
        </div>
      )}

      <FieldGroupTitle>{t('products.what')}</FieldGroupTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label={t('products.sellsAs')} hint={t('products.sellsAsHint')}>
          <input
            className="lf-input"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            data-testid="product-name"
          />
        </Field>
        <Field label={t('products.nameAr')} hint={t('products.nameArHint')}>
          <input
            dir="rtl"
            className="lf-input"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            data-testid="product-name-ar"
          />
        </Field>
      </div>

      <Field label={t('products.category')} hint={t('products.categoryHint')}>
        <input className="lf-input" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="product-category" />
      </Field>

      <Field label={t('products.icon')} hint={t('products.iconHint')}>
        <div className="flex flex-wrap gap-1.5" data-testid="product-icons">
          {PRODUCT_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setEmoji(icon)}
              title={icon}
              data-testid={`product-icon-${icon}`}
              className={clsx(
                'w-10 h-10 rounded-xl2 border flex items-center justify-center',
                emoji === icon ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand',
              )}
            >
              <Icon name={icon} size={20} />
            </button>
          ))}
        </div>
      </Field>

      <FieldGroupTitle>{t('products.howSold')}</FieldGroupTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label={t('price.saleUnit')} hint={t('price.billingWillBe', { billing: billingLabel(billing, kind.engineKind) })}>
          <Select
            value={saleUnit}
            onChange={(v) => setSaleUnit(v as SaleUnit)}
            options={saleUnitsFor(kind.engineKind, SALE_UNITS).map((value) => ({ label: t(`price.unit.${value}`), value }))}
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

      <FieldGroupTitle>{t('products.money')}</FieldGroupTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label={t('price.base')} required hint={t('price.baseHint')}>
          <NumberInput min={0} step={0.5} value={basePrice} onChange={setBasePrice} testId="asset-edit-base" />
        </Field>
        <Field label={t('price.deposit')} hint={t('price.depositHint')}>
          <NumberInput min={0} step={0.5} value={deposit} onChange={setDeposit} testId="asset-edit-deposit" />
        </Field>
        <Field label={t('price.penalty')} hint={t('price.penaltyHint')}>
          <NumberInput min={0} step={0.5} value={penalty} onChange={setPenalty} testId="asset-edit-penalty" />
        </Field>
        {keepsTime && (
          <Field label={t('price.overtime')} hint={t('price.overtimeHint')}>
            <NumberInput min={0} step={0.5} value={overtime} onChange={setOvertime} testId="asset-edit-overtime" />
          </Field>
        )}
        {soldByTour && (
          <>
            <Field label={t('products.tourPrice')}>
              <NumberInput min={0} step={0.5} value={tourPrice} onChange={setTourPrice} testId="product-tour-price" />
            </Field>
            <Field label={t('products.tourMinutes')}>
              <NumberInput min={1} step={5} value={tourMinutes} onChange={setTourMinutes} testId="product-tour-minutes" />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} data-testid="product-active" />
          {t('products.active')}
        </label>
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={clearOverrides}
            onChange={(e) => setClearOverrides(e.target.checked)}
            data-testid="asset-edit-clear-overrides"
          />
          {t('price.clearOverrides')}
        </label>
      </div>
    </Modal>
  )
}
