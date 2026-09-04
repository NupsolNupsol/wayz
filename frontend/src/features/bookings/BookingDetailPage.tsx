import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Banknote, Hourglass, Printer, Receipt, TriangleAlert, Package, Boxes, ScanLine, Check, RefreshCw, User, Phone, ShieldCheck, ReceiptText, Truck, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle, StatusBadge, Button, EmptyState, Field, Spinner } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { IdentityVerificationModal, VerificationTrail } from '@/components/IdentityVerification'
import { StorageScanPanel } from '@/components/StorageScanPanel'
import { DeliveryRequestModal } from '@/features/delivery/DeliveryRequestModal'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { useStationDeliveries } from '@/hooks'
import { Select } from '@/components/Select'
import { Barcode } from '@/components/Barcode'
import { Timer } from '@/components/Timer'
import { useAssetUnit, useBooking, useBookingOrder, useTransitions, useTransition, useScanOut, useReassign, useCreateIncident, useIncidentCatalogue, useUnits, useRefundPosition, useRefundBooking } from '@/hooks'
import { NumberInput } from '@/components/NumberInput'
import { InvoiceModal } from '@/features/invoice/InvoiceModal'
import { AmountDuePanel } from './AmountDuePanel'
import { isUnfinishedSale, resumeRoute } from './resumeDraft'
import { DevClockPanel } from './DevClockPanel'
import { ApiError } from '@/api/client'
import { formatDateTime, money } from '@/utils'
import { useActionLabel } from '@/i18n/useActionLabel'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { toast } from '@/state/toastStore'
import type { AvailableTransition, IncidentType } from '@/api/types'
import type { TransitionPayload } from '@/api/booking.api'

export function BookingDetailPage() {
  const { t } = useTranslation(['bookings', 'common'])
  const actionLabel = useActionLabel()
  const statusLabel = useStatusLabel()
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: booking, isLoading } = useBooking(id)
  const { data: order } = useBookingOrder(id)
  const { data: catalogue } = useIncidentCatalogue()
  const { data: trans } = useTransitions(id)
  const transitionMut = useTransition()
  const scanMut = useScanOut()
  const reassignMut = useReassign()
  const incidentMut = useCreateIncident()
  const { data: units = [] } = useUnits()
  const role = useAuthStore((st) => st.me?.role)
  const mayArrangeDelivery = can(role, 'delivery.request')
  const { data: stationDeliveries } = useStationDeliveries({ bookingId: id }, !!id && mayArrangeDelivery)

  const [labelsOpen, setLabelsOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replaceUnit, setReplaceUnit] = useState('')
  const [replaceReason, setReplaceReason] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignUnit, setReassignUnit] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [incType, setIncType] = useState<IncidentType>('MISSING_BAG')
  const [incDesc, setIncDesc] = useState('')
  const [manualScan, setManualScan] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [dueNow, setDueNow] = useState(0)
  const [collectSignal, setCollectSignal] = useState(0)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundReason, setRefundReason] = useState('')
  const { data: refundPosition } = useRefundPosition(id)
  const reservedId = booking?.reservation?.assetUnitId ?? booking?.assetUnitId ?? undefined
  const heldByAnotherDesk = !!reservedId && !units.some((u) => u._id === reservedId)
  const { data: heldUnitDetail } = useAssetUnit(heldByAnotherDesk ? reservedId : undefined)
  const heldUnit = heldUnitDetail ? { _id: heldUnitDetail._id, identifier: heldUnitDetail.identifier } : undefined
  const refundMut = useRefundBooking()

  const unfinished = !!booking && !!order && isUnfinishedSale(booking, order)
  const outstanding = Math.max(0, Math.round(((order?.total ?? 0) - (refundPosition?.paid ?? 0)) * 100) / 100)
  const resumable = unfinished && can(role, 'pos.use')
  useEffect(() => {
    if (resumable && booking) navigate(resumeRoute(booking), { replace: true })
  }, [resumable, booking, navigate])

  if (isLoading) return <Spinner />
  if (!booking || !id) {
    return (
      <div>
        <PageHeader helpId="booking-detail" title={t('page.booking')} crumbs={[{ label: t('common:crumb.bookings'), to: '/bookings' }, { label: t('common:crumb.notfound') }]} />
        <Card><EmptyState title={t('page.notFound')} /></Card>
      </div>
    )
  }

  const engineTypes = catalogue?.byEngine?.[booking.engineKind] ?? []
  const incidentOptions = engineTypes.map((type) => ({
    label: t(`status:incidentType.${type}`, { defaultValue: catalogue?.labels?.[type] ?? type.replaceAll('_', ' ') }),
    value: type,
  }))

  const verifications = booking.verifications ?? []
  const overtimeState = booking.session?.overtime
  const lastChargeStartedAt =
    overtimeState && overtimeState.chargeableHours > 0 && overtimeState.graceEndsAt
      ? new Date(overtimeState.graceEndsAt).getTime() + (overtimeState.chargeableHours - 1) * 3_600_000
      : null
  const hasFreshVerification = verifications.some(
    (v) =>
      v.purpose === 'RETRIEVAL' &&
      v.status === 'VERIFIED' &&
      new Date(v.expiresAt).getTime() > Date.now() &&
      (lastChargeStartedAt === null || new Date(v.verifiedAt).getTime() >= lastChargeStartedAt),
  )
  const outstayedTheirCheck =
    lastChargeStartedAt !== null &&
    !hasFreshVerification &&
    verifications.some((v) => v.purpose === 'RETRIEVAL' && v.status === 'VERIFIED')

  const buildPayload = (code: string): TransitionPayload => {
    switch (code) {
      case 'TO_HANDOVER':
        return { inspectionDone: true, durationMin: booking.session.requestedDurationMin }
      case 'TO_STARTED':
        return { safetyAck: true, boardingVerified: true }
      default:
        return {}
    }
  }

  const fire = (code: string, label: string) =>
    transitionMut.mutate(
      { id, code, payload: buildPayload(code) },
      {
        onSuccess: () => toast('success', actionLabel(label) + ' ✓'),
        onError: (e) => toast('danger', t('toast.blocked'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )

  const runTransition = (transition: AvailableTransition) => {
    if (transition.code === 'TO_REPLACED') {
      setReplaceUnit(availableAssetUnits[0]?._id ?? '')
      setReplaceReason('')
      setReplaceOpen(true)
      return
    }
    if (transition.code === 'TO_REASSIGNED') {
      setReassignUnit(units.find((u) => u.assetTypeId === (booking.metadata?.assetTypeId as string) && u.status === 'AVAILABLE')?._id ?? '')
      setReassignOpen(true)
      return
    }
    if (transition.code === 'TO_STORED') {
      setStoreOpen(true)
      return
    }
    if (transition.code === 'TO_RETRIEVAL' && !hasFreshVerification) {
      setVerifyOpen(true)
      return
    }
    fire(transition.code, transition.label)
  }

  const doReplace = () => {
    transitionMut.mutate(
      { id, code: 'TO_REPLACED', payload: { unitId: replaceUnit, reason: replaceReason } },
      {
        onSuccess: () => {
          toast('warning', t('replace.done'), t('replace.doneDetail'))
          setReplaceOpen(false)
        },
        onError: (e) => toast('danger', t('replace.failed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const scanOut = (barcode: string) => {
    scanMut.mutate({ id, barcode }, {
      onSuccess: (b) => { toast('success', t('toast.scanned')); setManualScan(''); void b },
      onError: (e) => toast('danger', t('toast.scanRejected'), e instanceof ApiError ? e.message : ''),
    })
  }

  const doReassign = () => {
    reassignMut.mutate({ id, unitId: reassignUnit, reason: reassignReason }, {
      onSuccess: () => { toast('warning', t('toast.reassigned')); setReassignOpen(false); setReassignReason('') },
      onError: (e) => toast('danger', t('toast.reassignFailed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
    })
  }

  const refundable = refundPosition?.refundable ?? 0
  const refundedSoFar = refundPosition?.refunded ?? 0
  const awaitingApproval = refundPosition?.pending ?? null
  const mayRefund = can(role, 'refund.request') && refundable > 0 && !awaitingApproval

  const openRefund = () => {
    setRefundAmount(refundable)
    setRefundReason('')
    setRefundOpen(true)
  }

  const submitRefund = () => {
    refundMut.mutate(
      { id, amount: refundAmount, reason: refundReason.trim() },
      {
        onSuccess: (res) => {
          setRefundOpen(false)
          if (res.approved) {
            toast('success', t('toast.refundDone'), t('toast.refundDetail', { amount: money(res.refunded), ref: booking.ref }))
          } else {
            toast('info', t('toast.refundAsked'), t('toast.refundAskedDetail', { ref: res.request?.ref ?? '', amount: money(refundAmount) }))
          }
        },
        onError: (e) =>
          toast('danger', t('toast.refundRefused'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const openIncident = () => {
    if (engineTypes.length) setIncType(engineTypes[0])
    setIncidentOpen(true)
  }

  const submitIncident = () => {
    incidentMut.mutate({ type: incType, description: incDesc, bookingId: id }, {
      onSuccess: () => { toast('warning', t('toast.incidentReported')); setIncidentOpen(false); setIncDesc('') },
    })
  }

  const s = booking.session
  const unit = units.find((u) => u._id === booking.assetUnitId)
  const reservedUnitId = booking.reservation?.assetUnitId ?? booking.assetUnitId
  const reservedUnit = units.find((u) => u._id === reservedUnitId) ?? heldUnit
  const availableAssetUnits = units.filter((u) => u.assetTypeId === (booking.metadata?.assetTypeId as string) && u.status === 'AVAILABLE')
  const inRetrieval = booking.status === 'RETRIEVAL_IN_PROGRESS'
  const canDeliver =
    mayArrangeDelivery && booking.engineKind === 'SHOP_AND_DROP' && ['ACTIVE', 'OVERTIME'].includes(booking.status)
  const openDelivery = (stationDeliveries ?? []).find(
    (d) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status),
  )
  const canBeginRetrieval = (trans?.transitions ?? []).some((tr) => tr.code === 'TO_RETRIEVAL')
  const workflowActions = trans?.transitions ?? []
  const HANDS_BACK = ['TO_RETRIEVAL', 'TO_COMPLETED', 'TO_SERVED', 'TO_RETURNED']
  const owed = Math.max(dueNow, outstanding)
  const blockedByMoney = (code: string) => owed > 0 && HANDS_BACK.includes(code)
  const awaitingRetrievalCheck = canBeginRetrieval && !hasFreshVerification

  return (
    <div data-testid="booking-detail">
      <PageHeader
        helpId="booking-detail"
        title={booking.ref}
        subtitle={`${booking.productName}${booking.customerName ? ` · ${booking.customerName}` : ''}`}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.bookings'), to: '/bookings' }, { label: booking.ref }]}
        actions={
          <>
            {order && (
              <Button variant="secondary" onClick={() => setInvoiceOpen(true)} data-testid="booking-invoice-slip">
                <ReceiptText size={16} /> {t('page.salesInvoice')}
              </Button>
            )}
            {booking.bags.length > 0 && <Button variant="secondary" onClick={() => setLabelsOpen(true)} data-testid="booking-labels"><Printer size={16} /> {t('page.labels')}</Button>}
            {canDeliver && !openDelivery && (
              <Button variant="secondary" onClick={() => setDeliveryOpen(true)} data-testid="booking-request-delivery">
                <Truck size={16} /> {t('page.sendToCustomer')}
              </Button>
            )}
            {mayRefund && (
              <Button variant="secondary" onClick={openRefund} data-testid="booking-refund">
                <Undo2 size={16} /> {t('page.refund')}
              </Button>
            )}
            <Button variant="danger" onClick={openIncident} data-testid="booking-incident"><TriangleAlert size={16} /> {t('page.incident')}</Button>
          </>
        }
      />

      {openDelivery && (
        <Card className="mb-5 p-4 border-brand/40 bg-brand/5 flex flex-wrap items-center justify-between gap-3" data-testid="booking-open-delivery">
          <div className="flex items-start gap-3 min-w-0">
            <Truck size={18} className="text-brand shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy dark:text-dk-texthi">
                {t('page.deliveryLine', { id: openDelivery._id, status: statusLabel(openDelivery.status, 'delivery') })}
              </p>
              <p className="text-xs text-muted truncate">{t('page.goingTo', { address: openDelivery.destination.address })}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/deliveries')} data-testid="booking-open-delivery-link">
            {t('page.openDeliveries')}
          </Button>
        </Card>
      )}

      {awaitingApproval && (
        <Card className="mb-5 p-4 border-amber-400/50 bg-amber-50/60 dark:bg-amber-900/10" data-testid="booking-refund-pending">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Hourglass size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy dark:text-dk-texthi">
                  {t('page.refundWaiting', { ref: awaitingApproval.ref, amount: money(awaitingApproval.amount) })}
                </p>
                <p className="text-xs text-muted">
                  {t('page.refundWaitingWho', { name: awaitingApproval.requestedByName })} · {awaitingApproval.reason}
                </p>
              </div>
            </div>
            {refundPosition?.canApprove && (
              <Button variant="secondary" onClick={() => navigate('/refund-requests')} data-testid="booking-refund-review">
                {t('page.refundReview')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {booking.refunds?.length > 0 && (
        <Card className="mb-5 p-4 border-amber-400/50 bg-amber-50/60 dark:bg-amber-900/10" data-testid="booking-refunds">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle className="flex items-center gap-2">
              <Undo2 size={16} className="text-amber-600" /> {t('page.refunded')}
            </SectionTitle>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums" data-testid="booking-refunded-total">
              {money(refundedSoFar)}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {booking.refunds.map((r, i) => (
              <div key={`${r.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm" data-testid={`booking-refund-${i}`}>
                <span className="font-semibold tabular-nums text-navy dark:text-dk-texthi">{money(r.amount)}</span>
                <span className="text-muted">{r.reason}</span>
                <span className="text-xs text-muted">
                  {r.refundedByName || r.refundedBy} · {formatDateTime(new Date(r.at).getTime())}
                </span>
              </div>
            ))}
          </div>
          {refundable > 0 && (
            <p className="text-xs text-muted mt-2">{t('page.stillRefundable', { amount: money(refundable) })}</p>
          )}
        </Card>
      )}

      <Card className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>{t('page.actions')}</SectionTitle>
          <StatusBadge status={booking.status} />
        </div>
        {awaitingRetrievalCheck && (
          <div className="lf-card p-3 mb-3 flex flex-wrap items-center justify-between gap-3 border-brand/40 bg-brand/5" data-testid="verify-required">
            <p className="text-sm flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand" />
              <span>{outstayedTheirCheck ? t('page.verifyAgain') : t('page.verifyLocked')}</span>
            </p>
            <Button variant="secondary" onClick={() => setVerifyOpen(true)} data-testid="verify-open">{t('page.verifyOpen')}</Button>
          </div>
        )}
        {canBeginRetrieval && hasFreshVerification && (
          <div className="lf-card p-3 mb-3 flex items-center gap-2 border-success/50 bg-emerald-50 dark:bg-emerald-900/20" data-testid="verify-ready">
            <ShieldCheck size={16} className="text-success" />
            <span className="text-sm text-success font-medium">{t('page.verified')}</span>
          </div>
        )}
        {owed > 0 && workflowActions.some((tr) => HANDS_BACK.includes(tr.code)) && (
          <div
            className="lf-card p-3 mb-3 flex flex-wrap items-center gap-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20"
            data-testid="handover-blocked"
          >
            <Banknote size={16} className="text-amber-600 dark:text-amber-300" />
            <span className="text-sm text-navy dark:text-dk-texthi flex-1 min-w-0">
              {awaitingRetrievalCheck ? t('page.verifyBeforePayment', { amount: money(owed) }) : t('page.payFirst', { amount: money(owed) })}
            </span>
            <Button
              onClick={() => setCollectSignal((n) => n + 1)}
              disabled={awaitingRetrievalCheck}
              title={awaitingRetrievalCheck ? t('page.verifyBeforePayment', { amount: money(owed) }) : undefined}
              data-testid="handover-take-payment"
            >
              <Banknote size={16} /> {t('page.takePayment', { amount: money(owed) })}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2" data-testid="transition-actions">
          {workflowActions.length === 0 && <p className="text-sm text-muted">{t('page.noActions')}</p>}
          {workflowActions.map((transition) => (
            <button
              key={transition.code}
              onClick={() => runTransition(transition)}
              disabled={transitionMut.isPending || blockedByMoney(transition.code)}
              title={blockedByMoney(transition.code) ? t('page.payFirst', { amount: money(owed) }) : undefined}
              data-testid={`action-${transition.code}`}
              className="lf-btn text-white shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: transition.style?.backgroundColor ?? 'rgb(var(--brand))' }}
            >
              {transition.code === 'TO_REASSIGNED' && <RefreshCw size={15} />} {actionLabel(transition.label)}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <div className="flex items-center justify-between mb-3"><SectionTitle>{t('page.session')}</SectionTitle><StatusBadge status={s.status} /></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Meta label={t('meta.kind')} value={statusLabel(s.kind, 'sessionKind')} />
              <Meta label={t('meta.unit')} value={unit?.identifier ?? '—'} />
              <Meta label={t('meta.started')} value={formatDateTime(s.startedAt ? new Date(s.startedAt).getTime() : null)} />
              <Meta label={t('meta.expectedEnd')} value={formatDateTime(s.expectedEndAt ? new Date(s.expectedEndAt).getTime() : null)} />
            </div>
            {s.startedAt ? (
              <div className="mt-3 flex items-center gap-2 text-sm"><span className="text-muted">{t('page.remaining')}</span> <Timer expectedEndAt={s.expectedEndAt} /></div>
            ) : (
              <p className="text-xs text-amber-600 mt-3">{t('page.timerNotStarted')}</p>
            )}
          </Card>

          {booking.bags.length > 0 && (
            <Card>
              <SectionTitle className="mb-3 flex items-center gap-2"><Boxes size={18} /> {t('page.bags', { count: booking.bags.length })}</SectionTitle>
              {inRetrieval && (
                <Field label={t('page.manualBarcode')}>
                  <div className="flex gap-2">
                    <input className="lf-input" value={manualScan} onChange={(e) => setManualScan(e.target.value)} placeholder={t('page.enterBarcode')} data-testid="retrieval-manual" />
                    <Button variant="secondary" onClick={() => scanOut(manualScan)} disabled={!manualScan.trim()} data-testid="retrieval-manual-scan">{t('page.scan')}</Button>
                  </div>
                </Field>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {booking.bags.map((b) => {
                  const out = b.status === 'RETRIEVED' || b.status === 'DELIVERED'
                  return (
                    <div key={b.index} className="lf-card p-3" data-testid={`bag-${b.index}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{t('page.bagLine', { index: b.index, description: b.description })}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <Barcode value={b.barcode} height={40} />
                      {inRetrieval && (
                        <button onClick={() => scanOut(b.barcode)} disabled={out} data-testid={`retrieval-scan-${b.index}`}
                          className={`mt-2 w-full lf-btn ${out ? 'bg-success/10 text-success' : 'lf-btn-secondary'}`}>
                          {out ? <><Check size={15} /> {t('page.scannedOut')}</> : <><ScanLine size={15} /> {t('page.scanOut')}</>}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {booking.packingPlan && (
            <Card>
              <SectionTitle className="mb-2">{t('page.packingPlan')}</SectionTitle>
              <p className="text-sm"><strong>{booking.packingPlan.numberOfCompartmentsRequired}</strong> {t('page.compartmentsFor', { count: booking.bags.length })}</p>
              <p className="text-xs text-muted mt-1">{booking.packingPlan.priceCalculationSummary}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><User size={18} /> {t('page.customer')}</SectionTitle>
            <p className="text-base font-semibold text-navy dark:text-dk-text">{booking.customerName || '—'}</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted"><Phone size={14} /> {booking.customerPhone || '—'}</div>
            {booking.customerId && (
              <button type="button" onClick={() => navigate(`/customers/${booking.customerId}`)} className="mt-3 text-xs font-medium text-brand hover:underline">{t('page.viewProfile')}</button>
            )}
          </Card>
          {order && (
            <Card data-testid="booking-charges">
              <SectionTitle className="mb-3 flex items-center gap-2"><Receipt size={18} /> {t('page.charges')}</SectionTitle>
              <div className="flex flex-col gap-1.5 text-sm">
                {order.lines.map((line, i) => (
                  <div key={`${line.productId}-${i}`} className="flex items-baseline justify-between gap-3" data-testid={`booking-charge-${i}`}>
                    <span className="text-muted">
                      {line.name}
                      {line.quantity > 1 && <span className="text-xs"> × {line.quantity}</span>}
                    </span>
                    <span className="tabular-nums">{money(line.unitPrice * line.quantity)}</span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 text-muted pt-1.5 border-t border-line">
                  <span>{t('page.subtotal')}</span>
                  <span className="tabular-nums">{money(order.subtotal)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-muted">
                  <span>{t('page.vat')}</span>
                  <span className="tabular-nums">{money(order.vat)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 font-bold text-navy dark:text-dk-texthi text-base">
                  <span>{t('page.charged')}</span>
                  <span className="tabular-nums" data-testid="booking-charged-total">{money(order.total)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
                  <span>{t('page.paidSoFar')}</span>
                  <span className="tabular-nums" data-testid="booking-paid-total">{money(refundPosition?.paid ?? 0)}</span>
                </div>
                {outstanding > 0 && (
                  <div className="flex items-baseline justify-between gap-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <span>{t('page.outstanding')}</span>
                    <span className="tabular-nums" data-testid="booking-outstanding">{money(outstanding)}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {verifications.length > 0 && (
            <Card>
              <SectionTitle className="mb-3 flex items-center gap-2"><ShieldCheck size={18} /> {t('page.identityChecks')}</SectionTitle>
              <VerificationTrail verifications={verifications} />
            </Card>
          )}
          {!unfinished && (
            <AmountDuePanel
              bookingId={id}
              overtime={booking.session?.overtime}
              openSignal={collectSignal}
              blockedReason={awaitingRetrievalCheck ? t('page.verifyBeforePayment', { amount: money(dueNow) }) : null}
              onDueChange={setDueNow}
            />
          )}

          <DevClockPanel bookingId={id} hasStarted={!!s.startedAt} />

          <Card>
            <SectionTitle className="mb-3 flex items-center gap-2"><Package size={18} /> {t('page.custody')}</SectionTitle>
            {booking.custody.length === 0 ? <p className="text-sm text-muted">{t('page.noCustody')}</p> : (
              <ol className="relative border-s border-line ms-2">
                {booking.custody.map((c, i) => (
                  <li key={i} className="ms-4 pb-4 last:pb-0">
                    <span className="absolute -start-1.5 w-3 h-3 rounded-full bg-brand" />
                    <p className="text-sm font-medium">{c.from} → {c.to}</p>
                    <p className="text-xs text-muted">{c.note} · {formatDateTime(new Date(c.at).getTime())}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        title={t('replace.title')}
        subtitle={t('replace.subtitle')}
        testId="replace-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplaceOpen(false)}>{t('common:action.cancel')}</Button>
            <Button
              variant="danger"
              onClick={doReplace}
              loading={transitionMut.isPending}
              disabled={!replaceUnit || replaceReason.trim().length < 3}
              data-testid="replace-submit"
            >
              {t('replace.submit')}
            </Button>
          </>
        }
      >
        <Field
          label={t('replace.unit')}
          required
          error={availableAssetUnits.length === 0 ? t('replace.noneFree') : undefined}
        >
          <Select
            value={replaceUnit}
            onChange={setReplaceUnit}
            searchable
            placeholder={t('reassign.choose')}
            options={availableAssetUnits.map((u) => ({ label: u.identifier, value: u._id }))}
            testId="replace-unit-select"
          />
        </Field>
        <Field label={t('replace.reason')} required hint={t('replace.reasonHint')}>
          <input className="lf-input" value={replaceReason} onChange={(e) => setReplaceReason(e.target.value)} data-testid="replace-reason" />
        </Field>
      </Modal>

      <InvoiceModal bookingId={id} trackingToken={booking.trackingToken} open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />

      <Modal open={labelsOpen} onClose={() => setLabelsOpen(false)} title={t('labelsModal.title')} subtitle={t('labelsModal.subtitle')} size="md"
        footer={<><Button variant="ghost" onClick={() => setLabelsOpen(false)}>{t('common:action.close')}</Button><Button onClick={() => window.print()} className="no-print"><Printer size={15} /> {t('labelsModal.print')}</Button></>}>
        <div className="receipt-print grid grid-cols-1 sm:grid-cols-2 gap-3">
          {booking.bags.map((b) => (
            <div key={b.index} className="lf-card p-3 text-center">
              <p className="text-xs text-muted">{booking.ref}</p>
              <p className="font-semibold text-sm mb-2">{t('page.bagLine', { index: b.index, description: b.description })}</p>
              <Barcode value={b.barcode} height={44} />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        title={t('store.title')}
        subtitle={t('store.subtitle')}
        size="lg"
        testId="store-modal"
      >
        {reservedUnit ? (
          <StorageScanPanel
            bags={booking.bags}
            unitId={reservedUnit._id}
            unitIdentifier={reservedUnit.identifier}
            durationMin={booking.session.requestedDurationMin}
            pending={transitionMut.isPending}
            onConfirm={(payload) =>
              transitionMut.mutate(
                { id, code: 'TO_STORED', payload },
                {
                  onSuccess: () => { toast('success', t('toast.stored'), t('toast.storedDetail')); setStoreOpen(false) },
                  onError: (e) => toast('danger', t('toast.storeFailed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
                },
              )
            }
          />
        ) : (
          <p className="text-sm text-muted">{t('store.noReservation')}</p>
        )}
      </Modal>

      <DeliveryRequestModal
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        bookingId={id}
        customerName={booking.customerName}
        customerPhone={booking.customerPhone}
        customerEmail={booking.customerEmail}
      />

      <IdentityVerificationModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        bookingId={id}
        customerName={booking.customerName}
        customerEmail={booking.customerEmail}
        onVerified={() => {
          setVerifyOpen(false)
          if (dueNow <= 0) fire('TO_RETRIEVAL', 'Begin retrieval')
        }}
      />

      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title={t('reassign.title')} subtitle={t('reassign.subtitle')} testId="reassign-modal"
        footer={<><Button variant="ghost" onClick={() => setReassignOpen(false)}>{t('common:action.cancel')}</Button><Button variant="danger" onClick={doReassign} loading={reassignMut.isPending} disabled={!reassignReason.trim() || !reassignUnit} data-testid="reassign-submit">{t('reassign.submit')}</Button></>}>
        <Field label={t('reassign.unit')}><Select value={reassignUnit} onChange={setReassignUnit} searchable placeholder={t('reassign.choose')} options={availableAssetUnits.map((u) => ({ label: u.identifier, value: u._id }))} testId="reassign-unit-select" /></Field>
        <Field label={t('reassign.reason')} required><input className="lf-input" value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder={t('reassign.reasonPlaceholder')} data-testid="reassign-reason" /></Field>
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title={t('refundModal.title')}
        subtitle={t('refundModal.subtitle', { paid: money(refundPosition?.paid ?? 0), refundable: money(refundable) })}
        testId="refund-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundOpen(false)}>{t('common:action.cancel')}</Button>
            <Button
              variant="danger"
              onClick={submitRefund}
              loading={refundMut.isPending}
              disabled={refundReason.trim().length < 3 || refundAmount <= 0 || refundAmount > refundable}
              data-testid="refund-submit"
            >
              <Undo2 size={16} /> {t('refundModal.submit', { amount: money(refundAmount) })}
            </Button>
          </>
        }
      >
        <Field label={t('refundModal.amount')} required hint={t('refundModal.amountHint')}>
          <NumberInput min={0} max={refundable} step={0.01} value={refundAmount} onChange={setRefundAmount} testId="refund-amount" />
        </Field>
        {refundAmount > refundable && (
          <p className="text-sm text-danger-strong -mt-2 mb-3">{t('refundModal.tooMuch', { amount: money(refundable) })}</p>
        )}
        <Field label={t('refundModal.reason')} required hint={t('refundModal.reasonHint')}>
          <input
            className="lf-input"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder={t('refundModal.reasonPlaceholder')}
            data-testid="refund-reason"
          />
        </Field>
        <p className="text-xs text-muted">{t('refundModal.note')}</p>
      </Modal>

      <Modal open={incidentOpen} onClose={() => setIncidentOpen(false)} title={t('incidentModal.title')} testId="incident-modal"
        footer={<><Button variant="ghost" onClick={() => setIncidentOpen(false)}>{t('common:action.cancel')}</Button><Button variant="danger" onClick={submitIncident} loading={incidentMut.isPending} disabled={!incDesc.trim()} data-testid="incident-submit">{t('incidentModal.submit')}</Button></>}>
        <Field label={t('incidentModal.type')} hint={t('incidentModal.typeHint', { engine: t(`common:engine.${booking.engineKind}`) })}>
          <Select value={incType} onChange={(v) => setIncType(v as IncidentType)} options={incidentOptions} testId="booking-incident-type" />
        </Field>
        <Field label={t('incidentModal.description')} required><textarea className="lf-input h-24 py-2" value={incDesc} onChange={(e) => setIncDesc(e.target.value)} data-testid="incident-desc" /></Field>
      </Modal>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted">{label}</p><p className="font-semibold text-navy dark:text-dk-text">{value}</p></div>
}
