import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, PlayCircle, ShieldCheck, Camera } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, Field, SectionTitle, StatusBadge, Badge, EmptyState } from '@/components/ui'
import { Stepper, type Step } from '@/components/Stepper'
import { CustomerPicker } from '@/components/CustomerPicker'
import { OtpBox } from '@/components/OtpBox'
import { PaymentPanel, type PaymentSplit } from '@/components/PaymentPanel'
import { Timer } from '@/components/Timer'
import { Icon } from '@/components/Icon'
import { useProducts, useBookings, useCreateBooking, usePay, useTransition } from '@/hooks'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { engineLabel, engineTagline, productIcon } from '@/config/engineMeta'
import { money } from '@/utils'
import { useActionLabel } from '@/i18n/useActionLabel'
import { toast } from '@/state/toastStore'
import type { Booking, Customer, EngineKind, Order, Product } from '@/api/types'
import { NumberInput } from '@/components/NumberInput'

const FULFILMENT: Record<EngineKind, { code: string; label: string; flag?: 'inspectionDone' | 'safetyAck' | 'boardingVerified'; promptKey?: string } | null> = {
  SHOP_AND_DROP: null,
  MOBILITY: { code: 'TO_HANDOVER', label: 'Confirm handover & start rental', flag: 'inspectionDone', promptKey: 'agent:engine.prompt.inspectionDone' },
  LAGOON: { code: 'TO_STARTED', label: 'Verify boarding & start trip', flag: 'boardingVerified', promptKey: 'agent:engine.prompt.boardingVerified' },
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
  const { t } = useTranslation(['agent', 'common'])
  const actionLabel = useActionLabel()
  const navigate = useNavigate()
  const online = useAuthStore((s) => s.online)
  const { data: products = [] } = useProducts(engineKind)
  const { data: bookings = [] } = useBookings({ engineKind })
  const createMut = useCreateBooking()
  const payMut = usePay()
  const transitionMut = useTransition()

  const [step, setStep] = useState(0)
  const [product, setProduct] = useState<Product | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [duration, setDuration] = useState(1)
  const [visitors, setVisitors] = useState(2)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [flag, setFlag] = useState(false)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [order, setOrder] = useState<Order | null>(null)

  const fulfilment = FULFILMENT[engineKind]
  const active = bookings.filter((b) => ['ACTIVE', 'OVERTIME', 'PREPARING', 'CONFIRMED'].includes(b.status))

  const reset = () => { setStep(0); setProduct(null); setCustomer(null); setPhoneVerified(false); setFlag(false); setBooking(null); setOrder(null); setDuration(1); setVisitors(2) }

  // Everything up to payment is still editable. Stepping back from Payment throws away
  // the unpaid draft — the selections stay, so Continue simply builds a fresh one.
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
        durationMin: product.billingModel === 'DURATION_BASED' ? duration * 60 : undefined,
        quantity: product.billingModel === 'DURATION_BASED' ? undefined : Math.max(1, visitors),
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
      toast('success', t('engine.toast.paid'), t('engine.toast.awaitingFulfilment'))
      if (fulfilment) setStep(3)
      else { toast('info', t('engine.toast.sentToKitchen'), t('engine.toast.trackIt')); reset() }
    } catch (e) { toast('danger', t('engine.toast.paymentFailed'), e instanceof ApiError ? e.message : '') }
  }

  const fulfil = async () => {
    if (!booking || !fulfilment) return
    try {
      const payload: Record<string, boolean> = {}
      if (fulfilment.flag) payload[fulfilment.flag] = true
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
          <div className="grid grid-cols-2 gap-3 mt-2">
            {product.billingModel === 'DURATION_BASED' ? (
              <Field label={t('engine.durationPeriods')}><NumberInput min={1} value={duration} onChange={setDuration} testId="engine-duration" /></Field>
            ) : (
              <Field label={engineKind === 'COTE_RESTAURANT' ? 'Quantity' : 'Visitors'}><NumberInput min={1} value={visitors} onChange={setVisitors} testId="engine-visitors" /></Field>
            )}
          </div>
          <div className="flex justify-between mt-2">
            <Button variant="ghost" onClick={() => goToStep(0)} data-testid="engine-back-product">
              <ArrowLeft size={15} />{t('engine.changeProduct')}</Button>
            <Button onClick={createDraft} loading={createMut.isPending} disabled={!customer || !online} data-testid="engine-next">{t('engine.continue')}<ArrowRight size={15} /></Button>
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
          <label className="flex items-center gap-2 text-sm mb-4 justify-center" data-testid="engine-flag">
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} />
            {fulfilment.flag === 'inspectionDone' && <Camera size={15} />} {fulfilment.promptKey ? t(fulfilment.promptKey) : ''}
          </label>
          <div className="flex justify-center">
            <Button onClick={fulfil} loading={transitionMut.isPending} disabled={!flag || !online} data-testid="engine-fulfil-btn"><PlayCircle size={16} /> {actionLabel(fulfilment.label)}</Button>
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
