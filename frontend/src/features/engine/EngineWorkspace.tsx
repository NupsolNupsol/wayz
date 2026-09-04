import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, PlayCircle, Sailboat, ShieldCheck, Camera } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, Field, SectionTitle, StatusBadge, Badge, EmptyState } from '@/components/ui'
import { Stepper, type Step } from '@/components/Stepper'
import { CustomerPicker } from '@/components/CustomerPicker'
import { isUnfinishedSale } from '@/features/bookings/resumeDraft'
import { OtpBox } from '@/components/OtpBox'
import { PaymentPanel, type PaymentSplit } from '@/components/PaymentPanel'
import { Timer } from '@/components/Timer'
import { Icon } from '@/components/Icon'
import { useProducts, useBooking, useBookingOrder, useBookings, useCreateBooking, useCustomer, usePay, useTransition, useUnits } from '@/hooks'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { useBoatsWithRoom } from '@/hooks'
import { engineLabel, engineTagline, productIcon } from '@/config/engineMeta'
import { isCustomerComplete, money } from '@/utils'
import { useActionLabel } from '@/i18n/useActionLabel'
import { toast } from '@/state/toastStore'
import { sendInvoiceOnPayment } from '@/features/invoice/sendInvoiceOnPayment'
import type { Booking, Customer, EngineKind, Order, Product } from '@/api/types'
import { NumberInput } from '@/components/NumberInput'
import { Select } from '@/components/Select'

const FULFILMENT: Record<EngineKind, { code: string; label: string; flag?: 'inspectionDone' | 'safetyAck' | 'boardingVerified'; promptKey?: string } | null> = {
  SHOP_AND_DROP: null,
  MOBILITY: { code: 'TO_HANDOVER', label: 'Confirm handover & start rental', flag: 'inspectionDone', promptKey: 'agent:engine.prompt.inspectionDone' },
  LAGOON: null,
  ANAAM: { code: 'TO_STARTED', label: 'Confirm safety & start experience', flag: 'safetyAck', promptKey: 'agent:engine.prompt.safetyAck' },
  COTE_RESTAURANT: null,
}

const STEPS: Step[] = [
  { key: 'product', labelKey: 'agent:engine.step.product' },
  { key: 'details', labelKey: 'agent:engine.step.details' },
  { key: 'payment', labelKey: 'agent:engine.step.payment' },
  { key: 'fulfil', labelKey: 'agent:engine.step.fulfil' },
]

export function EngineWorkspace({ engineKind }: { engineKind: EngineKind }) {
  const [params, setParams] = useSearchParams()
  const resumeId = params.get('resume') ?? ''
  const { t } = useTranslation(['agent', 'common'])
  const actionLabel = useActionLabel()
  const navigate = useNavigate()
  const online = useAuthStore((s) => s.online)
  const { data: products = [] } = useProducts(engineKind)
  const { data: bookings = [] } = useBookings({ engineKind })
  const { data: units = [] } = useUnits()
  const createMut = useCreateBooking()
  const payMut = usePay()
  const transitionMut = useTransition()

  const [step, setStep] = useState(0)
  const [product, setProduct] = useState<Product | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [duration, setDuration] = useState(1)
  const [rateMode, setRateMode] = useState<'HOURS' | 'TOURS'>('HOURS')
  const [tours, setTours] = useState(1)
  const [visitors, setVisitors] = useState(2)
  const [boatId, setBoatId] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [flag, setFlag] = useState(false)
  const [unitId, setUnitId] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [order, setOrder] = useState<Order | null>(null)

  const customerReachable = !!customer && isCustomerComplete({ name: customer.name, phone: customer.phone })

  const sellsTours = !!product?.tourPrice && product.tourPrice > 0
  const sellsHours = !sellsTours || !!(product?.hourlyPrice ?? product?.basePrice)
  const byTours = sellsTours && rateMode === 'TOURS'
  const quoted = product
    ? byTours
      ? (product.tourPrice ?? 0) * Math.max(1, tours)
      : product.billingModel === 'DURATION_BASED'
        ? (product.hourlyPrice ?? product.basePrice) * Math.max(1, duration)
        : product.basePrice * Math.max(1, visitors)
    : 0

  const isLagoon = engineKind === 'LAGOON'
  const { data: boats = [] } = useBoatsWithRoom(product?.assetTypeId ?? undefined, isLagoon && !!product)
  const boat = boats.find((b) => b._id === boatId) ?? null
  const seatCap = boat ? Math.max(1, boat.free) : undefined

  const fulfilment = FULFILMENT[engineKind]
  const active = bookings.filter((b) => ['ACTIVE', 'OVERTIME', 'PREPARING', 'CONFIRMED'].includes(b.status))

  const reset = () => { setStep(0); setProduct(null); setCustomer(null); setPhoneVerified(false); setFlag(false); setUnitId(''); setBooking(null); setOrder(null); setDuration(1); setVisitors(2) }

  const freeUnits = units.filter((u) => u.assetTypeId === product?.assetTypeId && u.status === 'AVAILABLE')

  const paid = step > 2
  const canRevisit = (target: number) => !paid && target < step

  const goToStep = async (target: number) => {
    if (!canRevisit(target)) return
    if (booking && step === 2) {
      try {
        await transitionMut.mutateAsync({
          id: booking.id,
          code: 'TO_CANCELLED',
          payload: { reason: 'The agent went back to change the booking before paying.' },
        })
      } catch {
        toast('danger', t('engine.couldNotGoBack'), t('engine.draftNotReleased'))
        return
      }
      setBooking(null)
      setOrder(null)
      setPhoneVerified(false)
    }
    setStep(target)
  }

  const createDraft = async () => {
    if (!product || !customer) return
    try {
      const res = await createMut.mutateAsync({
        customerId: customer._id, engineKind, productId: product._id,
        rateMode: byTours ? 'TOURS' : undefined,
        tours: byTours ? Math.max(1, tours) : undefined,
        durationMin: !byTours && product.billingModel === 'DURATION_BASED' ? duration * 60 : undefined,
        quantity: byTours || product.billingModel === 'DURATION_BASED' ? undefined : Math.max(1, visitors),
        unitId: isLagoon ? boatId : undefined,
        metadata: { visitors },
      })
      setBooking(res.booking); setOrder(res.order); setStep(2)
    } catch (e) { toast('danger', t('engine.couldNotCreate'), e instanceof ApiError ? e.message : '') }
  }

  const pay = async (splits: PaymentSplit[]) => {
    if (!booking) return
    try {
      const res = await payMut.mutateAsync({ id: booking.id, splits: splits.map((s) => ({ method: s.method, cardScheme: s.cardScheme ?? null, amount: s.amount, kind: 'SALE' })) })
      setBooking(res.booking)
      void sendInvoiceOnPayment(res.booking.id, res.booking.trackingToken)
      toast('success', t('engine.toast.paid'), t('engine.toast.awaitingFulfilment'))
      if (fulfilment) setStep(3)
      else { toast('info', t('engine.toast.sentToKitchen'), t('engine.toast.trackIt')); reset() }
    } catch (e) { toast('danger', t('engine.toast.paymentFailed'), e instanceof ApiError ? e.message : '') }
  }

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
    setProduct(products.find((p) => p.name === resuming.productName) ?? null)
    setCustomer(resumingCustomer)
    setBooking(resuming)
    setOrder(resumingOrder)
    setStep(2)
    setParams({}, { replace: true })
  }, [resumeId, resuming, resumingOrder, resumingCustomer, products, booking, navigate, setParams])

  useEffect(() => {
    if (step !== 3) return
    if (unitId && freeUnits.some((u) => u._id === unitId)) return
    setUnitId(freeUnits[0]?._id ?? '')
  }, [step, unitId, freeUnits])

  const fulfil = async () => {
    if (!booking || !fulfilment) return
    try {
      const payload: Record<string, boolean | string> = {}
      if (fulfilment.flag) payload[fulfilment.flag] = true
      if (unitId) payload.unitId = unitId
      const b = await transitionMut.mutateAsync({ id: booking.id, code: fulfilment.code, payload })
      setBooking(b)
      toast('success', t('engine.toast.started'), t('engine.toast.timerStarted'))
      navigate(`/bookings/${b.id}`)
    } catch (e) { toast('danger', t('engine.toast.cannotStart'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '') }
  }

  return (
    <div data-testid={`engine-${engineKind}`}>
      <PageHeader helpId="engines" title={engineLabel(engineKind)} subtitle={engineTagline(engineKind)} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: engineLabel(engineKind) }]} />
      <div className="mb-5">
        <Stepper
          steps={fulfilment ? STEPS : STEPS.slice(0, 3)}
          current={step}
          onStep={goToStep}
          canRevisit={canRevisit}
        />
      </div>

      {step === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="engine-products">
          {products.map((p) => (
            <button key={p._id} onClick={() => { setProduct(p); setStep(1) }} data-testid={`product-${p._id}`} className="text-start">
              <Card className="lf-card-hover h-full">
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center"><Icon name={productIcon(p.name, engineKind)} size={22} /></div>
                  <div className="text-end"><p className="font-bold text-navy dark:text-dk-texthi">{money(p.basePrice)}</p>{p.durationUnit && <p className="text-[11px] text-muted">{t(`status:durationUnit.${p.durationUnit}`, { defaultValue: p.durationUnit.replace('_', ' ').toLowerCase() })}</p>}</div>
                </div>
                <h3 className="font-semibold mt-2">{p.name}</h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.depositRequired > 0 && <Badge tone="warning">{t('common:field.deposit', { defaultValue: 'Deposit' })} {money(p.depositRequired)}</Badge>}
                  {p.proposedPolicy && <Badge tone="neutral">{t('engine.proposedPolicy')}</Badge>}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {step === 1 && product && (
        <Card>
          <SectionTitle className="mb-1 flex items-center gap-2"><Icon name={productIcon(product.name, engineKind)} size={18} className="text-brand" /> {product.name}</SectionTitle>
          {product.proposedPolicy && (
            <div className="flex flex-wrap gap-1.5 my-2">
              <Badge tone="warning">{t('engine.proposedNotConfirmed')}</Badge>
              {product.depositRequired > 0 && <Badge tone="neutral">{t('common:field.deposit', { defaultValue: 'Deposit' })} {money(product.depositRequired)}</Badge>}
              {product.proposedPolicy.minAge != null && <Badge tone="neutral">Age {product.proposedPolicy.minAge}+</Badge>}
              {product.proposedPolicy.licenseRequired && <Badge tone="neutral">{t('engine.licenceRequired')}</Badge>}
            </div>
          )}
          <div className="mt-3"><CustomerPicker value={customer} onChange={setCustomer} /></div>
          {customer && !customerReachable && (
            <p className="text-xs text-danger-strong mt-1" role="alert" data-testid="engine-customer-incomplete">
              {t('engine.customerIncomplete')}
            </p>
          )}
          {sellsTours && (
            <div className="flex rounded-xl2 border border-line dark:border-dk-line overflow-hidden mt-3">
              <button
                type="button"
                onClick={() => setRateMode('HOURS')}
                disabled={!sellsHours}
                data-testid="engine-rate-hours"
                className={clsx(
                  'flex-1 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40',
                  rateMode === 'HOURS' ? 'bg-brand text-white' : 'bg-white dark:bg-dk-elevated text-muted',
                )}
              >
                {t('engine.byHour', { price: money(product.hourlyPrice ?? product.basePrice) })}
              </button>
              <button
                type="button"
                onClick={() => setRateMode('TOURS')}
                data-testid="engine-rate-tours"
                className={clsx(
                  'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                  rateMode === 'TOURS' ? 'bg-brand text-white' : 'bg-white dark:bg-dk-elevated text-muted',
                )}
              >
                {t('engine.byTour', { price: money(product.tourPrice ?? 0) })}
              </button>
            </div>
          )}

          {isLagoon && (
            <div className="mt-3" data-testid="engine-boats">
              <p className="text-xs uppercase tracking-wider text-muted font-bold mb-1.5">{t('engine.whichBoat')}</p>
              <p className="text-xs text-muted mb-2">{t('engine.whichBoatHint')}</p>
              {boats.length === 0 ? (
                <p className="text-sm text-muted" data-testid="engine-no-boats">{t('engine.noBoats')}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {boats.map((b) => {
                    const chosen = b._id === boatId
                    const full = b.free === 0
                    return (
                      <button
                        key={b._id}
                        type="button"
                        disabled={full}
                        onClick={() => {
                          setBoatId(b._id)
                          setVisitors((n) => Math.min(Math.max(1, n), b.free))
                        }}
                        data-testid={`engine-boat-${b._id}`}
                        className={clsx(
                          'lf-card p-3 text-start transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                          chosen ? 'border-brand ring-1 ring-brand/30 bg-brand/5' : 'hover:border-brand',
                        )}
                      >
                        <p className="font-semibold text-sm text-navy dark:text-dk-texthi flex items-center gap-2">
                          <Sailboat size={15} className={chosen ? 'text-brand' : 'text-muted'} />
                          {b.identifier}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {full ? t('engine.boatFull') : t('engine.seatsFree', { free: b.free, seats: b.seats })}
                        </p>
                        <div className="h-1.5 rounded-full bg-line dark:bg-dk-border mt-2 overflow-hidden">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((b.taken / b.seats) * 100)}%` }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-2">
            {byTours ? (
              <Field label={t('engine.tours')} hint={t('engine.toursHint', { minutes: product.tourMinutes ?? 60 })}>
                <NumberInput min={1} value={tours} onChange={setTours} testId="engine-tours" />
              </Field>
            ) : product.billingModel === 'DURATION_BASED' ? (
              <Field label={t('engine.durationPeriods')}><NumberInput min={1} value={duration} onChange={setDuration} testId="engine-duration" /></Field>
            ) : (
              <Field
                label={engineKind === 'COTE_RESTAURANT' ? 'Quantity' : 'Visitors'}
                hint={isLagoon ? (boat ? t('engine.seatsLeft', { free: boat.free, boat: boat.identifier }) : t('engine.pickABoatFirst')) : undefined}
              >
                <NumberInput
                  min={1}
                  max={seatCap}
                  value={visitors}
                  onChange={(n) => setVisitors(seatCap ? Math.min(n, seatCap) : n)}
                  disabled={isLagoon && !boat}
                  testId="engine-visitors"
                />
              </Field>
            )}
            <Field label={t('engine.price')}>
              <p className="lf-input flex items-center font-semibold tabular-nums" data-testid="engine-quoted-price">{money(quoted)}</p>
            </Field>
          </div>
          <div className="flex justify-between mt-2">
            <Button variant="ghost" onClick={() => goToStep(0)} data-testid="engine-back-product">
              <ArrowLeft size={15} />{t('engine.changeProduct')}</Button>
            <Button
              onClick={createDraft}
              loading={createMut.isPending}
              disabled={!customerReachable || !online || (isLagoon && !boat)}
              data-testid="engine-next"
            >{t('engine.continue')}<ArrowRight size={15} /></Button>
          </div>
        </Card>
      )}

      {step === 2 && booking && order && customer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SectionTitle className="mb-3">{t('engine.verifyAndPay')}</SectionTitle>
            <div className="mb-4"><OtpBox phone={customer.phone} email={customer.email} intent="VERIFY_PHONE" verified={phoneVerified} onVerified={setPhoneVerified} /></div>
            <PaymentPanel total={order.total} onConfirm={pay} confirming={payMut.isPending} disabled={!online || !phoneVerified} />
          </Card>
          <Card>
            <SectionTitle className="mb-3">{t('engine.summary')}</SectionTitle>
            <div className="flex flex-col gap-1 text-sm">
              {order.lines.map((l, i) => <div key={i} className="flex justify-between"><span>{l.name} {l.isDeposit && <span className="text-muted text-xs">(deposit)</span>}</span><span>{money(l.unitPrice * l.quantity)}</span></div>)}
              <div className="flex justify-between font-bold text-navy dark:text-dk-texthi border-t border-line mt-2 pt-2"><span>{t('common:field.total')}</span><span>{money(order.total)}</span></div>
            </div>
          </Card>
        </div>
      )}

      {step === 3 && booking && fulfilment && (
        <Card className="py-6" data-testid="engine-fulfil">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto mb-4"><ShieldCheck size={30} /></div>
          <SectionTitle className="text-center mb-3">{t('engine.confirmFulfilment')}</SectionTitle>
          <p className="text-sm text-muted text-center mb-4">{t('engine.fulfilNote')}</p>
          {freeUnits.length > 0 && (
            <div className="max-w-sm mx-auto mb-4">
              <Field label={t('engine.chooseUnit')} required hint={t('engine.chooseUnitHint')}>
                <Select
                  value={unitId}
                  onChange={setUnitId}
                  searchable
                  placeholder={t('engine.chooseUnitPlaceholder')}
                  options={freeUnits.map((u) => ({ label: u.identifier, value: u._id }))}
                  testId="engine-unit-select"
                />
              </Field>
            </div>
          )}
          {freeUnits.length === 0 && (
            <p className="text-sm text-amber-600 text-center mb-4" data-testid="engine-no-units">{t('engine.noFreeUnits')}</p>
          )}
          <label className="flex items-center gap-2 text-sm mb-4 justify-center" data-testid="engine-flag">
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} />
            {fulfilment.flag === 'inspectionDone' && <Camera size={15} />} {fulfilment.promptKey ? t(fulfilment.promptKey) : ''}
          </label>
          <div className="flex justify-center">
            <Button onClick={fulfil} loading={transitionMut.isPending} disabled={!flag || !online || (freeUnits.length > 0 && !unitId)} data-testid="engine-fulfil-btn"><PlayCircle size={16} /> {actionLabel(fulfilment.label)}</Button>
          </div>
        </Card>
      )}

      <div className="mt-8">
        <SectionTitle className="mb-3">{t('engine.activeOfKind', { engine: engineLabel(engineKind) })}</SectionTitle>
        {active.length === 0 ? <Card><EmptyState title={t('engine.nothingActive')} /></Card> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((b) => (
              <Card key={b.id} data-testid={`engine-active-${b.ref}`}>
                <div className="flex items-center justify-between mb-1"><span className="font-semibold text-sm">{b.ref}</span><StatusBadge status={b.status} /></div>
                <p className="text-sm">{b.productName}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-line"><Timer expectedEndAt={b.session.expectedEndAt} /><Button variant="secondary" onClick={() => navigate(`/bookings/${b.id}`)}>{t('common:action.open')}</Button></div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
