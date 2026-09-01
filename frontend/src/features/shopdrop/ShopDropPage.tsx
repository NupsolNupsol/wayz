import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Check, Printer, ArrowLeft, ArrowRight, PackageCheck, Boxes, Sparkles, Loader2, FileDown, Truck } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, Field, SectionTitle, StatusBadge, Badge } from '@/components/ui'
import { Stepper, type Step } from '@/components/Stepper'
import { CustomerPicker } from '@/components/CustomerPicker'
import { OtpBox } from '@/components/OtpBox'
import { PaymentPanel, type PaymentSplit } from '@/components/PaymentPanel'
import { Select } from '@/components/Select'
import { Barcode } from '@/components/Barcode'
import { Timer } from '@/components/Timer'
import { Modal } from '@/components/Modal'
import { StorageScanPanel, type StorageScanPayload } from '@/components/StorageScanPanel'
import { DeliveryRequestModal } from '@/features/delivery/DeliveryRequestModal'
import { useInvoiceDownload } from '@/features/invoice/useInvoiceDownload'
import { trackingUrl } from '@/api/public.api'
import { useProducts, useUnits, useCreateBooking, usePay, useReserve, useTransition, usePackingSuggestions } from '@/hooks'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { money } from '@/utils'
import { toast } from '@/state/toastStore'
import type { Booking, Customer, Order, PackingSuggestion } from '@/api/types'
import { NumberInput } from '@/components/NumberInput'

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
const toSuggestBag = (b: BagRow) => ({ category: b.category, dimensions: { w: b.w, h: b.h, d: b.d }, weight: b.weight })

export function ShopDropPage() {
  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const online = useAuthStore((s) => s.online)
  const { data: products = [] } = useProducts('SHOP_AND_DROP')
  const { data: units = [] } = useUnits()
  const suggestMut = usePackingSuggestions()
  const createMut = useCreateBooking()
  const payMut = usePay()
  const reserveMut = useReserve()
  const transitionMut = useTransition()
  const { download: downloadInvoice, generating: invoicePending } = useInvoiceDownload()

  const [step, setStep] = useState(0)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryId, setDeliveryId] = useState<string | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bags, setBags] = useState<BagRow[]>([defaultBag(1), defaultBag(2), defaultBag(3)])
  const [suggestions, setSuggestions] = useState<PackingSuggestion[]>([])
  const [productId, setProductId] = useState('')
  const [durationHours, setDurationHours] = useState(2)

  const [booking, setBooking] = useState<Booking | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)

  const priceOf = (pid: string) => products.find((p) => p._id === pid)?.basePrice ?? 0
  const selected = suggestions.find((s) => s.productId === productId)
  const reservedUnit = booking?.reservation ? units.find((u) => u._id === booking.reservation!.assetUnitId) : undefined

  const patchBag = (i: number, patch: Partial<BagRow>) => setBags((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))

  const reset = () => {
    setStep(0); setCustomer(null); setBags([defaultBag(1), defaultBag(2), defaultBag(3)]); setSuggestions([]); setProductId('')
    setDeliveryId(null); setDeliveryOpen(false)
    setBooking(null); setOrder(null); setPhoneVerified(false)
  }

  // Customer, bags and the compartment plan are all still editable. Stepping back from
  // Payment releases the held capacity along with the unpaid draft.
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

  const goToPlan = async () => {
    setStep(2)
    try {
      const res = await suggestMut.mutateAsync(bags.map(toSuggestBag))
      setSuggestions(res.suggestions)
      setProductId(res.recommendedProductId ?? res.suggestions[0]?.productId ?? '')
    } catch (e) {
      toast('danger', t('shopdrop.couldNotComputePlan'), e instanceof ApiError ? e.message : '')
    }
  }

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

  const pay = async (splits: PaymentSplit[]) => {
    if (!booking) return
    try {
      const res = await payMut.mutateAsync({ id: booking.id, splits: splits.map((s) => ({ method: s.method, cardScheme: s.cardScheme ?? null, amount: s.amount, kind: 'SALE' })) })
      setBooking(res.booking)
      toast('success', t('shopdrop.paymentCaptured'), t('shopdrop.bookingConfirmed'))
      setStep(4)
    } catch (e) { toast('danger', t('shopdrop.paymentFailed'), e instanceof ApiError ? e.message : '') }
  }

  const reserve = async () => {
    if (!booking) return
    try {
      const b = await reserveMut.mutateAsync({ id: booking.id })
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

      {step === 0 && (
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
            <SectionTitle className="mb-1 flex items-center gap-2"><Sparkles size={18} className="text-brand" />{t('shopdrop.suggestedCompartments')}</SectionTitle>
            <p className="text-sm text-muted mb-3">Ranked by the packing algorithm for your {bags.length} bag(s) — fewest compartments and tightest fit first. You can override the suggestion.</p>
            {suggestMut.isPending ? (
              <div className="flex items-center gap-2 text-muted py-8 justify-center"><Loader2 className="animate-spin" size={18} />{t('shopdrop.computingBestFit')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="sd-suggestions">
                {suggestions.map((s) => {
                  const isSel = s.productId === productId
                  const isRec = suggestMut.data?.recommendedProductId === s.productId
                  return (
                    <button key={s.productId} onClick={() => setProductId(s.productId)} data-testid={`sd-suggestion-${s.assetTypeName.replace(/\s+/g, '-')}`}
                      className={clsx('lf-card p-3 text-start transition-all', isSel ? 'border-brand ring-2 ring-brand/30' : 'hover:border-brand', !s.fits && 'opacity-70')}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-navy dark:text-dk-texthi">{s.assetTypeName}</span>
                        {isRec && <Badge tone="success"><Sparkles size={11} />{t('shopdrop.recommended')}</Badge>}
                      </div>
                      <p className="text-sm mt-1"><strong>{s.numberOfCompartments}</strong> compartment(s) · {money(priceOf(s.productId))}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {s.fits ? <Badge tone="info">{s.availableUnits} available</Badge> : <Badge tone="danger">{t('shopdrop.notEnoughUnits')}</Badge>}
                        {s.maxBagsPerCompartment != null && <Badge tone="neutral">≤ {s.maxBagsPerCompartment} bags/unit</Badge>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="mt-4"><Field label={t('shopdrop.storageDuration')}><NumberInput min={1} value={durationHours} onChange={setDurationHours} testId="sd-duration" /></Field></div>
            <div className="flex justify-between mt-2">
              <Button variant="ghost" onClick={() => goToStep(1)} data-testid="sd-back-bags"><ArrowLeft size={15} />{t('shopdrop.changeBags')}</Button>
              <Button onClick={holdAndDraft} loading={createMut.isPending} disabled={!online || !productId || suggestMut.isPending} data-testid="sd-hold">{t('shopdrop.checkAvailability')}<ArrowRight size={15} /></Button>
            </div>
          </Card>
          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><Boxes size={18} /> Plan</SectionTitle>
            {selected ? (
              <div className="lf-card p-3 bg-canvas dark:bg-dk-elevated">
                <p className="text-sm">{t('shopdrop.chosen')} <strong>{selected.assetTypeName}</strong></p>
                <p className="text-2xl font-bold text-navy dark:text-dk-texthi mt-1" data-testid="sd-plan-compartments">{selected.numberOfCompartments}</p>
                <p className="text-xs text-muted">compartment(s) for {bags.length} bag(s)</p>
                <p className="text-sm font-semibold mt-2">{money(priceOf(selected.productId))}</p>
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
            <PaymentPanel total={order.total} onConfirm={pay} confirming={payMut.isPending} disabled={!online || !phoneVerified} />
            {!phoneVerified && <p className="text-xs text-amber-600 mt-2">{t('shopdrop.verifyPhoneFirst')}</p>}
          </Card>
          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><Boxes size={18} />{t('shopdrop.packingPlanQuote')}</SectionTitle>
            <div className="lf-card p-3 bg-canvas dark:bg-dk-elevated mb-3">
              <p className="text-sm"><strong data-testid="sd-compartments">{booking.packingPlan?.numberOfCompartmentsRequired ?? 1}</strong> compartment(s) for {booking.bags.length} bag(s)</p>
              <p className="text-xs text-muted mt-1">{booking.packingPlan?.priceCalculationSummary}</p>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between text-muted"><span>{t('shopdrop.subtotal')}</span><span>{money(order.subtotal)}</span></div>
              <div className="flex justify-between text-muted"><span>VAT</span><span>{money(order.vat)}</span></div>
              <div className="flex justify-between font-bold text-navy dark:text-dk-texthi text-base mt-1"><span>{t('common:field.total')}</span><span data-testid="sd-quote">{money(order.total)}</span></div>
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
              <Button variant="secondary" onClick={() => void downloadInvoice(booking, order)} loading={invoicePending} data-testid="sd-invoice">
                <FileDown size={15} />{t('shopdrop.downloadInvoice')}</Button>
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
