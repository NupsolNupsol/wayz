import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, TriangleAlert, Package, Boxes, ScanLine, Check, RefreshCw, User, Phone, ShieldCheck, FileDown, Truck, Undo2 } from 'lucide-react'
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
import { useBooking, useBookingOrder, useTransitions, useTransition, useScanOut, useReassign, useCreateIncident, useIncidentCatalogue, useUnits, useRefundPosition, useRefundBooking } from '@/hooks'
import { NumberInput } from '@/components/NumberInput'
import { useInvoiceDownload } from '@/features/invoice/useInvoiceDownload'
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
  const { download: downloadInvoice, generating: invoicePending } = useInvoiceDownload()
  const transitionMut = useTransition()
  const scanMut = useScanOut()
  const reassignMut = useReassign()
  const incidentMut = useCreateIncident()
  const { data: units = [] } = useUnits()
  const role = useAuthStore((st) => st.me?.role)
  const mayArrangeDelivery = can(role, 'delivery.request')
  const { data: stationDeliveries } = useStationDeliveries({ bookingId: id }, !!id && mayArrangeDelivery)

  const [labelsOpen, setLabelsOpen] = useState(false)
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
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundReason, setRefundReason] = useState('')
  const { data: refundPosition } = useRefundPosition(id)
  const refundMut = useRefundBooking()

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
  const hasFreshVerification = verifications.some(
    (v) => v.purpose === 'RETRIEVAL' && v.status === 'VERIFIED' && new Date(v.expiresAt).getTime() > Date.now(),
  )

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
  const mayRefund = can(role, 'refund.request') && refundable > 0

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
          toast('success', t('toast.refundDone'), t('toast.refundDetail', { amount: money(res.refunded), ref: booking.ref }))
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
  const reservedUnit = units.find((u) => u._id === reservedUnitId)
  const availableAssetUnits = units.filter((u) => u.assetTypeId === (booking.metadata?.assetTypeId as string) && u.status === 'AVAILABLE')
  const inRetrieval = booking.status === 'RETRIEVAL_IN_PROGRESS'
  const canDeliver =
    mayArrangeDelivery && booking.engineKind === 'SHOP_AND_DROP' && ['ACTIVE', 'OVERTIME'].includes(booking.status)
  const openDelivery = (stationDeliveries ?? []).find(
    (d) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status),
  )
  const canBeginRetrieval = (trans?.transitions ?? []).some((tr) => tr.code === 'TO_RETRIEVAL')
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
              <Button variant="secondary" onClick={() => void downloadInvoice(booking, order)} loading={invoicePending} data-testid="booking-invoice">
                <FileDown size={16} /> {t('page.invoice')}
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
              <span>{t('page.verifyLocked')}</span>
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
        <div className="flex flex-wrap gap-2" data-testid="transition-actions">
          {(trans?.transitions ?? []).length === 0 && <p className="text-sm text-muted">{t('page.noActions')}</p>}
          {(trans?.transitions ?? []).map((transition) => (
            <button
              key={transition.code}
              onClick={() => runTransition(transition)}
              disabled={transitionMut.isPending}
              data-testid={`action-${transition.code}`}
              className="lf-btn text-white shadow-card disabled:opacity-50"
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
          {verifications.length > 0 && (
            <Card>
              <SectionTitle className="mb-3 flex items-center gap-2"><ShieldCheck size={18} /> {t('page.identityChecks')}</SectionTitle>
              <VerificationTrail verifications={verifications} />
            </Card>
          )}
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
          fire('TO_RETRIEVAL', 'Begin retrieval')
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
