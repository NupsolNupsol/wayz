import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Minus, Plus, Check, Printer, ArrowLeft, ArrowRight, PackageCheck, Boxes, Loader2, ReceiptText, Truck } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, Field, SectionTitle, StatusBadge, Badge } from '@/components/ui'
import { Stepper, type Step } from '@/components/Stepper'
import { CustomerPicker } from '@/components/CustomerPicker'
import { OtpBox } from '@/components/OtpBox'
import { DiscountButton } from '@/components/DiscountButton'
import { VoucherField } from '@/components/VoucherField'
import { PaymentPanel, type PaymentSplit } from '@/components/PaymentPanel'
import { Select } from '@/components/Select'
import { Barcode } from '@/components/Barcode'
import { Timer } from '@/components/Timer'
import { Modal } from '@/components/Modal'
import { StorageScanPanel, type StorageScanPayload } from '@/components/StorageScanPanel'
import { DeliveryRequestModal } from '@/features/delivery/DeliveryRequestModal'
import { InvoiceModal } from '@/features/invoice/InvoiceModal'
import { isUnfinishedSale } from '@/features/bookings/resumeDraft'
import { readDraft, writeDraft, type WorkspaceDraft } from '@/features/bookings/workspaceDraft'
import { bookingApi } from '@/api/booking.api'
import { trackingUrl } from '@/api/public.api'
import { useUnits, useBooking, useBookingOrder, useCreateBooking, useCustomer, usePay, useReserve, useTransition } from '@/hooks'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { localName, money } from '@/utils'
import { toast } from '@/state/toastStore'
import { sendInvoiceOnPayment } from '@/features/invoice/sendInvoiceOnPayment'
import type { AssetUnit, Booking, Customer, Order } from '@/api/types'
import { NumberInput } from '@/components/NumberInput'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { DataTable, type Column } from '@/components/DataTable'

const STEPS: Step[] = [
  { key: 'customer', labelKey: 'agent:shopdrop.stepCustomer' },
  { key: 'bags', labelKey: 'agent:shopdrop.stepBags' },
  { key: 'plan', labelKey: 'agent:shopdrop.stepPlan' },
  { key: 'payment', labelKey: 'agent:shopdrop.stepPayment' },
  { key: 'store', labelKey: 'agent:shopdrop.stepStore' },
  { key: 'done', labelKey: 'agent:shopdrop.stepDone' },
]

type BagCategory = 'SOFT' | 'HARD' | 'OVERSIZE' | 'FRAGILE'
interface BagRow { description: string; category: BagCategory; w: number; h: number; d: number; weight: number }
const defaultBag = (i: number): BagRow => ({ description: `Bag ${i}`, category: 'SOFT', w: 30, h: 25, d: 20, weight: 3 })

/** Distinct from the engine workspace's own key, so the two never read each other's shape. */
const DRAFT_KEY = 'shopdrop-counter'

interface BagDraft extends WorkspaceDraft {
  extra?: { bags?: BagRow[]; productId?: string; durationHours?: number }
}

export function ShopDropPage() {
  const { t } = useTranslation(['agent', 'bookings', 'common'])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const resumeId = params.get('resume') ?? ''
  const online = useAuthStore((s) => s.online)
  const { data: units = [] } = useUnits()
  const statusLabel = useStatusLabel()
  const createMut = useCreateBooking()
  const payMut = usePay()
  const reserveMut = useReserve()
  const transitionMut = useTransition()

  const [step, setStep] = useState(0)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryId, setDeliveryId] = useState<string | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bags, setBags] = useState<BagRow[]>([defaultBag(1)])
  const [productId, setProductId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [freeOnly, setFreeOnly] = useState(true)
  const [durationHours, setDurationHours] = useState(2)

  const [booking, setBooking] = useState<Booking | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [restoring, setRestoring] = useState(() => !!readDraft(DRAFT_KEY))
  const [resumed, setResumed] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  const { data: resuming } = useBooking(resumeId || undefined)
  const { data: resumingOrder } = useBookingOrder(resumeId || undefined)
  const { data: resumingCustomer } = useCustomer(resuming?.customerId)

  useEffect(() => {
    if (!resumeId || booking) return
    if (!resuming || !resumingOrder || !resumingCustomer) return
    if (!isUnfinishedSale(resuming, resumingOrder)) {
      setParams({}, { replace: true })
      navigate(`/bookings/${resumeId}`, { replace: true })
      return
    }
    setCustomer(resumingCustomer)
    setBags(
      resuming.bags.map((b, i) => ({ ...defaultBag(i + 1), description: b.description || `Bag ${i + 1}` })),
    )
    setBooking(resuming)
    setOrder(resumingOrder)
    setStep(3)
    setParams({}, { replace: true })
  }, [resumeId, resuming, resumingOrder, resumingCustomer, booking, navigate, setParams])

  const draft = restoring ? readDraft<BagDraft>(DRAFT_KEY) : null
  const draftBookingQuery = useBooking(draft?.bookingId || undefined)
  const draftOrderQuery = useBookingOrder(draft?.bookingId || undefined)
  const draftCustomerQuery = useCustomer(draft?.customerId || undefined)
  const { data: draftBooking } = draftBookingQuery
  const { data: draftOrder } = draftOrderQuery
  const { data: draftCustomer } = draftCustomerQuery

  /**
   * A last resort on the restore.
   *
   * The counter is held blank while we work out whether a half-finished sale is coming back, so
   * anything that can stall that decision stalls the whole screen. If it has not settled in a few
   * seconds, the draft is abandoned and the agent gets a counter they can work — a lost draft is a
   * nuisance, a counter that never loads is a queue.
   */
  useEffect(() => {
    if (!restoring) return
    const id = window.setTimeout(() => {
      writeDraft(DRAFT_KEY, null)
      setRestoring(false)
    }, 6_000)
    return () => window.clearTimeout(id)
  }, [restoring])

  /** Coming back to the counter picks the bag drop up where it was left, rather than starting over. */
  useEffect(() => {
    if (!restoring) return
    if (resumeId) {
      setRestoring(false)
      return
    }
    const snap = readDraft<BagDraft>(DRAFT_KEY)
    if (!snap) {
      setRestoring(false)
      return
    }
    // Wait only while something is genuinely in flight.
    const fetching =
      (!!snap.customerId && draftCustomerQuery.isLoading) ||
      (!!snap.bookingId && (draftBookingQuery.isLoading || draftOrderQuery.isLoading))
    if (fetching) return

    // Settled with nothing to show for it: the booking or customer the draft points at is gone.
    // Drop the draft rather than waiting on data that is never coming.
    if ((snap.customerId && !draftCustomer) || (snap.bookingId && (!draftBooking || !draftOrder))) {
      writeDraft(DRAFT_KEY, null)
      setRestoring(false)
      return
    }

    if (snap.bookingId && draftBooking && draftOrder && !isUnfinishedSale(draftBooking, draftOrder)) {
      writeDraft(DRAFT_KEY, null)
      setRestoring(false)
      return
    }

    if (draftCustomer) setCustomer(draftCustomer)
    if (snap.extra?.bags) setBags(snap.extra.bags as BagRow[])
    if (snap.extra?.productId) setProductId(String(snap.extra.productId))
    if (snap.extra?.durationHours) setDurationHours(Number(snap.extra.durationHours))
    if (draftBooking) setBooking(draftBooking)
    if (draftOrder) setOrder(draftOrder)
    setStep(snap.step)
    setResumed(true)
    setRestoring(false)
  }, [
    restoring,
    resumeId,
    draftBooking,
    draftOrder,
    draftCustomer,
    draftBookingQuery.isLoading,
    draftOrderQuery.isLoading,
    draftCustomerQuery.isLoading,
  ])

  useEffect(() => {
    if (restoring) return
    if (step === 0 && !customer && !booking) {
      writeDraft(DRAFT_KEY, null)
      return
    }
    if (step > 3) {
      // The sale is paid and stored; there is nothing half-finished left to come back to.
      writeDraft(DRAFT_KEY, null)
      return
    }
    writeDraft(DRAFT_KEY, {
      step,
      customerId: customer?._id ?? null,
      bookingId: booking?.id ?? null,
      extra: { bags, productId, durationHours },
    })
  }, [restoring, step, customer, booking, bags, productId, durationHours])

  const reservedUnit = booking?.reservation ? units.find((u) => u._id === booking.reservation!.assetUnitId) : undefined

  const patchBag = (i: number, patch: Partial<BagRow>) => setBags((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))

  const reset = () => {
    writeDraft(DRAFT_KEY, null)
    setResumed(false)
    setStep(0); setCustomer(null); setBags([defaultBag(1)]); setProductId(''); setUnitId('')
    setDeliveryId(null); setDeliveryOpen(false)
    setBooking(null); setOrder(null); setPhoneVerified(false)
  }

  const paid = step > 3
  const canRevisit = (target: number) => !paid && target < step

  const goToStep = async (target: number) => {
    if (!canRevisit(target)) return
    if (booking && step === 3) {
      try {
        await transitionMut.mutateAsync({
          id: booking.id,
          code: 'TO_CANCELLED',
          payload: { reason: 'The agent went back to change the booking before paying.' },
        })
      } catch {
        toast('danger', t('shopdrop.couldNotGoBack'), t('shopdrop.heldNotReleased'))
        return
      }
      setBooking(null)
      setOrder(null)
      setPhoneVerified(false)
    }
    setStep(target)
  }

  /**
   * The agent chooses the compartment themselves, from what this desk is holding — no ranked
   * suggestion to accept or argue with. Anything already picked is cleared if it has since been
   * taken by another sale.
   */
  const goToPlan = () => {
    setStep(2)
    if (unitId && !(units ?? []).some((u) => u._id === unitId && u.status === 'AVAILABLE')) {
      setUnitId('')
      setProductId('')
    }
  }

  /**
   * The compartments this desk actually holds.
   *
   * The agent picks a physical unit rather than a size, so what they choose on this step is what
   * gets locked at the next one — no recommendation to second-guess, and nothing that can turn out
   * to be standing at another desk.
   */
  const compartments = useMemo(
    () => (units ?? []).filter((u) => u.assetKind === 'COMPARTMENT' || u.engineKind === 'SHOP_AND_DROP'),
    [units],
  )
  const freeCompartments = useMemo(() => compartments.filter((u) => u.status === 'AVAILABLE'), [compartments])
  const compartmentRows = freeOnly ? freeCompartments : compartments
  const roomyEnough = useMemo(
    () => freeCompartments.filter((u) => (u.maxBags ?? 0) >= bags.length).length,
    [freeCompartments, bags.length],
  )

  const sizeOptions = useMemo(
    () => [...new Set(compartments.map((u) => u.assetTypeName))].sort().map((name) => ({ label: name, value: name })),
    [compartments],
  )
  const statusOptions = useMemo(
    () => [...new Set(compartments.map((u) => u.status))].sort().map((s) => ({ label: statusLabel(s), value: s })),
    [compartments, statusLabel],
  )

  const chosenUnit = useMemo(() => compartments.find((u) => u._id === unitId) ?? null, [compartments, unitId])

  /** Choosing a compartment also chooses what it is sold as — the price comes from its own kind. */
  const pickUnit = (unit: AssetUnit) => {
    setUnitId(unit._id)
    setProductId(unit.productId ?? '')
  }

  const compartmentColumns: Column<AssetUnit>[] = [
    {
      key: 'identifier',
      header: t('shopdrop.compartment'),
      sortValue: (u) => u.identifier,
      filter: { kind: 'text', value: (u) => `${u.identifier} ${u.assetTypeName}` },
      render: (u) => (
        <div className="flex items-center gap-2">
          <input
            type="radio"
            checked={unitId === u._id}
            onChange={() => pickUnit(u)}
            disabled={u.status !== 'AVAILABLE'}
            aria-label={u.identifier}
            data-testid={`sd-pick-${u._id}`}
          />
          <span className="font-mono font-semibold text-navy dark:text-dk-texthi">{u.identifier}</span>
        </div>
      ),
    },
    {
      key: 'size',
      header: t('shopdrop.size'),
      sortValue: (u) => u.assetTypeName,
      filter: { kind: 'select', options: sizeOptions, value: (u) => u.assetTypeName },
      render: (u) => <span className="text-sm">{u.assetTypeName}</span>,
    },
    {
      key: 'holds',
      header: t('shopdrop.holds'),
      align: 'right',
      sortValue: (u) => u.maxBags ?? 0,
      render: (u) => (
        <span className={clsx('text-sm tabular-nums', (u.maxBags ?? 0) < bags.length && 'text-warn font-semibold')}>
          {u.maxBags ? t('shopdrop.bagsCount', { count: u.maxBags }) : '—'}
        </span>
      ),
    },
    {
      key: 'price',
      header: t('shopdrop.price'),
      align: 'right',
      sortValue: (u) => u.price ?? 0,
      render: (u) => <span className="text-sm tabular-nums">{u.price == null ? '—' : money(u.price)}</span>,
    },
    {
      key: 'status',
      header: t('common:column.status'),
      sortValue: (u) => u.status,
      filter: { kind: 'select', options: statusOptions, value: (u) => u.status },
      render: (u) => <StatusBadge status={u.status} />,
    },
  ]

  const holdAndDraft = async () => {
    if (!customer || !productId) return
    try {
      const res = await createMut.mutateAsync({
        customerId: customer._id, engineKind: 'SHOP_AND_DROP', productId,
        durationMin: durationHours * 60,
        bags: bags.map((b) => ({ description: b.description, category: b.category, dimensions: { w: b.w, h: b.h, d: b.d }, weight: b.weight })),
      })
      setBooking(res.booking); setOrder(res.order)
      toast('success', t('shopdrop.capacityHeld'), `${res.booking.packingPlan?.numberOfCompartmentsRequired ?? 1} compartment(s) held before payment.`)
      setStep(3)
    } catch (e) {
      toast('danger', t('shopdrop.couldNotCreate'), e instanceof ApiError ? e.message : '')
    }
  }

  /** What the customer is not being asked for, shown against the total so it cannot be misread. */
  const quoteDiscount = Math.abs(
    (order?.lines ?? []).filter((l) => l.unitPrice < 0).reduce((sum, l) => sum + l.unitPrice * (l.quantity ?? 1), 0),
  )

  /** After a discount or a code, the quote on screen has to be the one we are about to charge. */
  const refreshOrder = async () => {
    if (!booking) return
    try {
      setOrder(await bookingApi.order(booking.id))
    } catch {
      /* the panel keeps the figure it had; the server is the authority at payment */
    }
  }

  const pay = async (splits: PaymentSplit[]) => {
    if (!booking) return
    try {
      const res = await payMut.mutateAsync({ id: booking.id, splits: splits.map((s) => ({ method: s.method, cardScheme: s.cardScheme ?? null, amount: s.amount, kind: 'SALE', payerId: s.payerId })) })
      setBooking(res.booking)
      void sendInvoiceOnPayment(res.booking.id, res.booking.trackingToken)
      toast('success', t('shopdrop.paymentCaptured'), t('shopdrop.bookingConfirmed'))
      setStep(4)
    } catch (e) { toast('danger', t('shopdrop.paymentFailed'), e instanceof ApiError ? e.message : '') }
  }

  const reserve = async () => {
    if (!booking) return
    try {
      const b = await reserveMut.mutateAsync({ id: booking.id, unitId: unitId || undefined })
      setBooking(b)
      toast('success', t('shopdrop.unitReserved'), `${units.find((u) => u._id === b.reservation?.assetUnitId)?.identifier ?? ''} locked (Agent Lease).`)
    } catch (e) { toast('danger', t('shopdrop.reserveFailed'), e instanceof ApiError ? e.message : '') }
  }

  const confirmStorage = async (payload: StorageScanPayload) => {
    if (!booking) return
    try {
      const b = await transitionMut.mutateAsync({ id: booking.id, code: 'TO_STORED', payload })
      setBooking(b)
      toast('success', t('shopdrop.storageConfirmed'), t('shopdrop.timerStarted'))
      setStep(5)
    } catch (e) { toast('danger', t('shopdrop.cannotConfirmStorage'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '') }
  }

  return (
    <div data-testid="shopdrop-page">
      <PageHeader helpId="shop-drop" title={t('common:engine.SHOP_AND_DROP')} subtitle={t('shopdrop.subtitle')} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.shopdrop') }]} />
      <div className="mb-5">
        <Stepper steps={STEPS} current={step} onStep={goToStep} canRevisit={canRevisit} />
      </div>

      {resumed && step < 4 && (
        <Card className="mb-4 p-3 flex flex-wrap items-center justify-between gap-3 border-brand/40 bg-brand/5" data-testid="sd-resumed">
          <p className="text-sm text-navy dark:text-dk-text">{t('shopdrop.resumed')}</p>
          <Button variant="ghost" onClick={reset} data-testid="sd-resumed-discard">{t('shopdrop.startFresh')}</Button>
        </Card>
      )}

      {/* Same reason as the rental counter: no form until we know whether a half-finished bag drop
          is coming back, so a typed name cannot be swapped out mid-keystroke. */}
      {step === 0 && restoring && (
        <div className="flex justify-center py-10 text-muted" data-testid="shopdrop-restoring">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {step === 0 && !restoring && (
        <Card data-testid="shopdrop-wizard">
          <SectionTitle className="mb-3">{t('shopdrop.whoIsCustomer')}</SectionTitle>
          <CustomerPicker value={customer} onChange={setCustomer} />
          <div className="flex justify-end mt-4"><Button onClick={() => setStep(1)} disabled={!customer} data-testid="sd-next-customer">{t('common:action.continue')} <ArrowRight size={15} /></Button></div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>{t('shopdrop.registerEachBag')}</SectionTitle>
            <div className="flex items-center gap-2">
              <button onClick={() => setBags((b) => (b.length > 1 ? b.slice(0, -1) : b))} className="lf-btn-secondary !h-9 !px-3" data-testid="sd-bag-minus"><Minus size={15} /></button>
              <span className="font-bold text-lg w-8 text-center" data-testid="sd-bag-count">{bags.length}</span>
              <button onClick={() => setBags((b) => [...b, defaultBag(b.length + 1)])} className="lf-btn-secondary !h-9 !px-3" data-testid="sd-bag-plus"><Plus size={15} /></button>
            </div>
          </div>
          <p className="text-sm text-muted mb-4">{t('shopdrop.bagsIntro')}</p>

          <div className="hidden md:grid grid-cols-[1.4fr_1fr_1.6fr_0.8fr] gap-2 px-1 mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
            <span>{t('common:field.description')}</span><span>{t('common:field.type')}</span><span>{t('shopdrop.sizeWhd')}</span><span>{t('shopdrop.weightKg')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {bags.map((b, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1.6fr_0.8fr] gap-2 items-center" data-testid={`sd-bag-row-${i + 1}`}>
                <input className="lf-input !h-10" value={b.description} onChange={(e) => patchBag(i, { description: e.target.value })} data-testid={`sd-bag-desc-${i + 1}`} placeholder={t('shopdrop.bagPlaceholder', { index: i + 1 })} />
                <Select value={b.category} onChange={(v) => patchBag(i, { category: v as BagCategory })} size="sm" testId={`sd-bag-type-${i + 1}`}
                  options={[{ label: t('common:label.soft'), value: 'SOFT' }, { label: t('common:label.hard'), value: 'HARD' }, { label: t('common:label.oversize'), value: 'OVERSIZE' }, { label: t('common:label.fragile'), value: 'FRAGILE' }]} />
                <div className="flex items-center gap-1">
                  {(['w', 'h', 'd'] as const).map((dim) => (
                    <NumberInput key={dim} min={1} className="!h-10 !px-2 text-center" value={b[dim]} onChange={(v) => patchBag(i, { [dim]: v } as Partial<BagRow>)} testId={`sd-bag-${dim}-${i + 1}`} ariaLabel={t('shopdrop.bagDimension', { index: i + 1, dimension: dim })} />
                  ))}
                </div>
                <NumberInput min={0} className="!h-10" value={b.weight} onChange={(v) => patchBag(i, { weight: v })} testId={`sd-bag-weight-${i + 1}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4"><Button variant="ghost" onClick={() => goToStep(0)} data-testid="sd-back-customer"><ArrowLeft size={15} />{t('shopdrop.changeCustomer')}</Button><Button onClick={goToPlan} data-testid="sd-next-bags">{t('shopdrop.suggestCompartment')}<ArrowRight size={15} /></Button></div>
        </Card>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <SectionTitle className="mb-1 flex items-center gap-2">
              <Boxes size={18} className="text-brand" />
              {t('shopdrop.pickCompartment')}
            </SectionTitle>
            <p className="text-sm text-muted mb-3">{t('shopdrop.pickCompartmentBlurb', { count: bags.length })}</p>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={freeOnly}
                  onChange={(e) => setFreeOnly(e.target.checked)}
                  data-testid="sd-free-only"
                />
                {t('shopdrop.freeOnly')}
              </label>
              <Badge tone={freeCompartments.length ? 'info' : 'danger'} testId="sd-free-count">
                {t('shopdrop.freeHere', { count: freeCompartments.length })}
              </Badge>
              {roomyEnough > 0 && (
                <Badge tone="neutral" testId="sd-roomy-count">
                  {t('shopdrop.holdsYourBags', { count: roomyEnough })}
                </Badge>
              )}
            </div>

            <DataTable<AssetUnit>
              testId="sd-compartments"
              rows={compartmentRows}
              keyOf={(u) => u._id}
              pageSize={8}
              initialSort={{ key: 'identifier', dir: 'asc' }}
              onRowClick={(u) => {
                if (u.status === 'AVAILABLE') pickUnit(u)
              }}
              empty={{ title: t('shopdrop.noCompartments'), message: t('shopdrop.noCompartmentsHint') }}
              columns={compartmentColumns}
            />

            <div className="mt-4"><Field label={t('shopdrop.storageDuration')}><NumberInput min={1} value={durationHours} onChange={setDurationHours} testId="sd-duration" /></Field></div>
            <div className="flex justify-between mt-2">
              <Button variant="ghost" onClick={() => goToStep(1)} data-testid="sd-back-bags"><ArrowLeft size={15} />{t('shopdrop.changeBags')}</Button>
              <Button onClick={holdAndDraft} loading={createMut.isPending} disabled={!online || !unitId} data-testid="sd-hold">{t('shopdrop.checkAvailability')}<ArrowRight size={15} /></Button>
            </div>
          </Card>
          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><Boxes size={18} /> {t('shopdrop.chosenTitle')}</SectionTitle>
            {chosenUnit ? (
              <div className="lf-card p-3 bg-canvas dark:bg-dk-elevated" data-testid="sd-chosen">
                <p className="text-sm">{t('shopdrop.chosen')}</p>
                <p className="font-mono text-2xl font-bold text-navy dark:text-dk-texthi mt-1" data-testid="sd-chosen-unit">
                  {chosenUnit.identifier}
                </p>
                <p className="text-xs text-muted">{chosenUnit.assetTypeName}</p>
                {chosenUnit.maxBags != null && (
                  <p className={clsx('text-xs mt-2', chosenUnit.maxBags < bags.length ? 'text-warn font-semibold' : 'text-muted')}>
                    {chosenUnit.maxBags < bags.length
                      ? t('shopdrop.tightFit', { holds: chosenUnit.maxBags, bags: bags.length })
                      : t('shopdrop.roomFor', { count: chosenUnit.maxBags })}
                  </p>
                )}
                <p className="text-sm font-semibold mt-2">{chosenUnit.price == null ? '—' : money(chosenUnit.price)}</p>
              </div>
            ) : <p className="text-sm text-muted">{t('shopdrop.selectCompartment')}</p>}
          </Card>
        </div>
      )}

      {step === 3 && booking && order && customer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SectionTitle className="mb-3">{t('shopdrop.verifyAndPay')}</SectionTitle>
            <div className="mb-4"><OtpBox phone={customer.phone} email={customer.email} intent="VERIFY_PHONE" verified={phoneVerified} onVerified={setPhoneVerified} /></div>
            <VoucherField bookingId={booking.id} onApplied={refreshOrder} />
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <DiscountButton bookingId={booking.id} total={order.total} onDone={refreshOrder} />
            </div>
            <PaymentPanel total={order.total} discountOff={quoteDiscount} onConfirm={pay} confirming={payMut.isPending} disabled={!online || !phoneVerified} />
            {!phoneVerified && <p className="text-xs text-amber-600 mt-2">{t('shopdrop.verifyPhoneFirst')}</p>}
          </Card>
          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><Boxes size={18} />{t('shopdrop.packingPlanQuote')}</SectionTitle>
            <div className="lf-card p-3 bg-canvas dark:bg-dk-elevated mb-3">
              <p className="text-sm"><strong data-testid="sd-compartments">{booking.packingPlan?.numberOfCompartmentsRequired ?? 1}</strong> compartment(s) for {booking.bags.length} bag(s)</p>
              <p className="text-xs text-muted mt-1">{booking.packingPlan?.priceCalculationSummary}</p>
            </div>
            <div className="flex flex-col gap-1 text-sm" data-testid="sd-quote-lines">
              {/* Itemised, so a discount is visible against what it came off rather than implied by the total. */}
              {order.lines.map((line, i) => {
                const off = line.unitPrice < 0
                return (
                  <div
                    key={`${line.productId}-${i}`}
                    className={clsx('flex justify-between', off ? 'text-success font-medium' : 'text-muted')}
                    data-testid={off ? 'sd-quote-discount' : `sd-quote-line-${i}`}
                  >
                    <span>
                      {localName(line)}
                      {line.quantity > 1 && <span className="text-xs"> × {line.quantity}</span>}
                    </span>
                    <span className="tabular-nums">{money(line.unitPrice * line.quantity)}</span>
                  </div>
                )
              })}
              <div className="flex justify-between text-muted pt-1 border-t border-line"><span>{t('shopdrop.subtotal')}</span><span>{money(order.subtotal)}</span></div>
              <div className="flex justify-between text-muted"><span>VAT</span><span>{money(order.vat)}</span></div>
              <div className="flex justify-between font-bold text-navy dark:text-dk-texthi text-base mt-1">
                <span>{t('common:field.total')}</span>
                <span className="flex items-baseline gap-2">
                  {quoteDiscount > 0 && (
                    <span className="text-sm font-normal text-muted line-through tabular-nums" data-testid="sd-quote-before">
                      {money(order.total + quoteDiscount)}
                    </span>
                  )}
                  <span data-testid="sd-quote">{money(order.total)}</span>
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {step === 4 && booking && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SectionTitle className="mb-3">1 · Reserve a specific compartment</SectionTitle>
            <p className="text-sm text-muted mb-3">{t('shopdrop.reservationNote')}</p>
            {!reservedUnit ? (
              <Button onClick={reserve} loading={reserveMut.isPending} data-testid="sd-reserve">{t('shopdrop.reserveRecommended')}</Button>
            ) : (
              <div className="lf-card p-3 flex items-center gap-2" data-testid="sd-reserved-unit"><PackageCheck className="text-success" size={18} /><div><p className="font-semibold">{reservedUnit.identifier}</p><StatusBadge status="RESERVED" /></div></div>
            )}
            {reservedUnit && (<><SectionTitle className="mb-3 mt-6">2 · Labels</SectionTitle><Button variant="secondary" onClick={() => setLabelsOpen(true)} data-testid="sd-labels"><Printer size={15} /> Print bag labels ({booking.bags.length})</Button></>)}
          </Card>

          <Card>
            <SectionTitle className="mb-3">3 · Scan in & confirm storage</SectionTitle>
            {!reservedUnit ? <p className="text-sm text-muted">{t('shopdrop.reserveFirst')}</p> : (
              <StorageScanPanel
                bags={booking.bags}
                unitId={reservedUnit._id}
                unitIdentifier={reservedUnit.identifier}
                durationMin={durationHours * 60}
                onConfirm={confirmStorage}
                pending={transitionMut.isPending}
                disabled={!online}
                testIdPrefix="sd"
              />
            )}
          </Card>
        </div>
      )}

      {step === 5 && booking && (
        <Card className="text-center py-8" data-testid="sd-done">
          <div className="w-16 h-16 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto mb-4"><Check size={30} /></div>
          <h2 className="text-xl font-bold text-navy dark:text-dk-texthi">{t('shopdrop.storageActive')}</h2>
          <p className="text-muted mt-1">{booking.ref} · {reservedUnit?.identifier}</p>
          <div className="mt-3 flex items-center justify-center gap-2"><span className="text-muted text-sm">{t('shopdrop.remaining')}</span> <Timer expectedEndAt={booking.session.expectedEndAt} /></div>

          {deliveryId ? (
            <div className="mt-5 lf-card p-3 mx-auto max-w-sm border-brand/40 bg-brand/5" data-testid="sd-delivery-created">
              <p className="text-sm font-semibold text-navy dark:text-dk-texthi flex items-center justify-center gap-2">
                <Truck size={16} className="text-brand" /> Delivery {deliveryId} created
              </p>
              <p className="text-xs text-muted mt-1">{t('shopdrop.couriersCanSee')}</p>
            </div>
          ) : (
            <div className="mt-5 lf-card p-4 mx-auto max-w-md text-start" data-testid="sd-delivery-offer">
              <p className="text-sm font-semibold text-navy dark:text-dk-texthi flex items-center gap-2">
                <Truck size={16} className="text-brand" />{t('shopdrop.wantBagsBrought')}</p>
              <p className="text-xs text-muted mt-1 mb-3">{t('shopdrop.askNow')}</p>
              <Button variant="secondary" onClick={() => setDeliveryOpen(true)} data-testid="sd-request-delivery">{t('shopdrop.arrangeDelivery')}</Button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {order && (
              <Button variant="secondary" onClick={() => setInvoiceOpen(true)} data-testid="sd-invoice-slip">
                <ReceiptText size={15} />{t('bookings:invoice.title')}</Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/bookings/${booking.id}`)} data-testid="sd-view-booking">{t('shopdrop.viewBooking')}</Button>
            <Button onClick={reset} data-testid="sd-new-another">{t('shopdrop.newTransaction')}</Button>
          </div>
          <p className="mt-4 text-xs text-muted">
            {t('shopdrop.trackingLink')} <span className="font-mono">{trackingUrl(booking.trackingToken)}</span>
          </p>
        </Card>
      )}

      {booking && customer && (
        <DeliveryRequestModal
          open={deliveryOpen}
          onClose={() => setDeliveryOpen(false)}
          bookingId={booking.id}
          customerName={customer.name}
          customerPhone={customer.phone}
          customerEmail={customer.email}
          onCreated={(dlvId) => setDeliveryId(dlvId)}
        />
      )}

      {booking && <InvoiceModal bookingId={booking.id} trackingToken={booking.trackingToken} open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />}

      <Modal open={labelsOpen} onClose={() => setLabelsOpen(false)} title={t('shopdrop.bagLabels')} subtitle={t('shopdrop.oneBarcode')} size="md"
        footer={<><Button variant="ghost" onClick={() => setLabelsOpen(false)}>{t('common:action.close')}</Button><Button onClick={() => window.print()} className="no-print"><Printer size={15} />{t('shopdrop.print')}</Button></>}>
        <div className="receipt-print grid grid-cols-1 sm:grid-cols-2 gap-3">
          {booking?.bags.map((b) => (
            <div key={b.index} className="lf-card p-3 text-center">
              <p className="font-semibold text-sm mb-2">{t('shopdrop.bagLine', { index: b.index, description: b.description })}</p>
              <Barcode value={b.barcode} height={44} />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
