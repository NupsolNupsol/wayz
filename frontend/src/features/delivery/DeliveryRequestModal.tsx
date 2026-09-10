import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, ShieldCheck, Truck, Phone, CircleCheck, PackageSearch } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from '@/components/Modal'
import { Button, Field, Badge } from '@/components/ui'
import { IdentityVerificationModal } from '@/components/IdentityVerification'
import { useCreateDelivery, useCustomerBagsElsewhere, useExitGates } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import type { DeliveryOrigin } from '@/api/delivery.api'
import { PhoneInput } from '@/components/PhoneInput'
import { Select } from '@/components/Select'

/** Bags either go to an exit gate the customer walks to, or to an address the courier finds. */
type Destination = 'GATE' | 'ADDRESS'

/**
 * How the request reached the desk, which decides whether the customer has to prove who they are.
 *
 * The wording is looked up rather than written here: an agent working in Arabic was being asked
 * the one question on this form that decides whether a stranger can have somebody's luggage, in a
 * language they may not read.
 */
const ORIGINS: { value: DeliveryOrigin; key: string; icon: typeof MapPin }[] = [
  { value: 'AT_STORAGE', key: 'here', icon: CircleCheck },
  { value: 'CUSTOMER_CONTACT', key: 'remote', icon: Phone },
]

export function DeliveryRequestModal({
  open,
  onClose,
  bookingId,
  customerName,
  customerPhone,
  customerEmail,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  onCreated?: (deliveryId: string) => void
}) {
  const { t } = useTranslation('delivery')
  const create = useCreateDelivery()
  const elsewhere = useCustomerBagsElsewhere(bookingId, open)
  const otherKiosks = elsewhere.data ?? []

  const { data: gates = [], isLoading: gatesLoading, isError: gatesFailed } = useExitGates(open)
  const hasGates = gates.length > 0

  const [origin, setOrigin] = useState<DeliveryOrigin>('AT_STORAGE')
  const [address, setAddress] = useState('')
  const [gateId, setGateId] = useState('')
  const [picked, setPicked] = useState<Destination>('GATE')
  const [notes, setNotes] = useState('')
  const [contactPhone, setContactPhone] = useState(customerPhone ?? '')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verified, setVerified] = useState(false)
  const [alsoBookingIds, setAlsoBookingIds] = useState<string[]>([])

  const reset = () => {
    setOrigin('AT_STORAGE'); setAddress(''); setNotes(''); setContactPhone(customerPhone ?? ''); setVerified(false)
    setAlsoBookingIds([])
    // The modal is kept mounted, so without these the next request opens on the last one's choices.
    setPicked('GATE'); setGateId('')
  }

  const toggleKiosk = (id: string) =>
    setAlsoBookingIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const allPicked = otherKiosks.length > 0 && alsoBookingIds.length === otherKiosks.length
  const toggleAll = () => setAlsoBookingIds(allPicked ? [] : otherKiosks.map((k) => k.bookingId))
  const extraBags = otherKiosks
    .filter((k) => alsoBookingIds.includes(k.bookingId))
    .reduce((sum, k) => sum + k.bagCount, 0)

  useEffect(() => {
    if (open) setContactPhone(customerPhone ?? '')
  }, [open, customerPhone])
  const close = () => { reset(); onClose() }

  const needsProof = origin === 'CUSTOMER_CONTACT' && !verified

  /**
   * Where the bags are going, and the single thing that decides both the field on show and whether
   * the button turns on.
   *
   * A gate can only be chosen when this site has one. If the list is empty — or could not be read
   * at all — the only way to say where is an address, and asking for a gate id that is never
   * offered would leave the desk with a form it can never submit.
   */
  // While the list is still coming, hold the choice the desk made rather than flashing the address
  // field and snapping back to the gate a moment later.
  const destination: Destination = hasGates || gatesLoading ? picked : 'ADDRESS'
  const saidWhere = destination === 'GATE' ? !!gateId : address.trim().length >= 3
  const ready = saidWhere && !needsProof

  const submit = () => {
    create.mutate(
      {
        bookingId,
        alsoBookingIds: alsoBookingIds.length ? alsoBookingIds : undefined,
        ...(destination === 'GATE' ? { toKioskId: gateId } : { address: address.trim() }),
        notes: notes.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        origin,
      },
      {
        onSuccess: (d) => {
          toast('success', `Delivery ${d._id} created`, 'Couriers at this site can see it now.')
          onCreated?.(d._id)
          close()
        },
        onError: (e) => toast('danger', t('request.couldNotCreate'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title={t('request.title')}
        subtitle={`${customerName} · booking ${bookingId}`}
        size="lg"
        testId="delivery-request-modal"
        footer={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={submit} loading={create.isPending} disabled={!ready} data-testid="delivery-request-submit">
              <Truck size={16} />{t('request.create')}</Button>
          </>
        }
      >
        <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2">{t('request.howAsked')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {ORIGINS.map((o) => {
            const active = origin === o.value
            const Ico = o.icon
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { setOrigin(o.value); setVerified(false) }}
                data-testid={`delivery-origin-${o.value}`}
                className={clsx(
                  'lf-card p-3 text-left transition-colors',
                  active ? 'border-brand ring-1 ring-brand/30 bg-brand/5' : 'hover:border-brand',
                )}
              >
                <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-2 text-sm">
                  <Ico size={16} className={active ? 'text-brand' : 'text-muted'} /> {t(`request.origin.${o.key}.title`)}
                </p>
                <p className="text-xs text-muted mt-1">{t(`request.origin.${o.key}.blurb`)}</p>
              </button>
            )
          })}
        </div>

        {origin === 'CUSTOMER_CONTACT' && (
          <div
            className={clsx(
              'lf-card p-3 mb-5 flex items-start gap-3',
              verified ? 'border-success bg-emerald-50 dark:bg-emerald-900/20' : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20',
            )}
            data-testid="delivery-verify-gate"
          >
            <ShieldCheck size={18} className={clsx('shrink-0 mt-0.5', verified ? 'text-success' : 'text-amber-600 dark:text-amber-300')} />
            <div className="flex-1 min-w-0">
              {verified ? (
                <>
                  <p className="text-sm font-semibold text-success">{t('request.verified')}</p>
                  <p className="text-xs text-muted">{t('request.proofSpent')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-navy dark:text-dk-texthi">{t('request.verifyFirst')}</p>
                  <p className="text-xs text-muted mb-2">{t('request.codeGoesTo')}</p>
                  <Button variant="secondary" onClick={() => setVerifyOpen(true)} data-testid="delivery-verify-open">
                    <ShieldCheck size={16} />{t('request.verifyIdentity')}</Button>
                </>
              )}
            </div>
          </div>
        )}

        {otherKiosks.length > 0 && (
          <div className="lf-card p-3 mb-5" data-testid="delivery-other-kiosks">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-2 text-sm">
                <PackageSearch size={16} className="text-brand" />
                {t('request.alsoHolding', { count: otherKiosks.length })}
              </p>
              <label className="flex items-center gap-2 text-xs font-semibold text-brand cursor-pointer">
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={toggleAll}
                  data-testid="delivery-kiosk-all"
                />
                {t('request.bringEverything')}
              </label>
            </div>
            <p className="text-xs text-muted mb-3">{t('request.alsoHoldingHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {otherKiosks.map((k) => {
                const picked = alsoBookingIds.includes(k.bookingId)
                return (
                  <label
                    key={k.bookingId}
                    className={clsx(
                      'lf-card p-3 flex items-start gap-3 cursor-pointer transition-colors',
                      picked ? 'border-brand ring-1 ring-brand/30 bg-brand/5' : 'hover:border-brand',
                    )}
                    data-testid={`delivery-kiosk-${k.kioskId ?? k.bookingId}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={picked}
                      onChange={() => toggleKiosk(k.bookingId)}
                      data-testid={`delivery-kiosk-check-${k.bookingId}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm text-navy dark:text-dk-texthi truncate">{k.kioskName}</span>
                      <span className="block text-xs text-muted truncate">
                        {k.assetUnitIdentifier ?? '—'} · {t('request.bagCount', { count: k.bagCount })} · {k.bookingRef}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            {alsoBookingIds.length > 0 && (
              <Badge tone="info" className="mt-3" testId="delivery-extra-summary">
                {t('request.extraStops', { stops: alsoBookingIds.length, bags: extraBags })}
              </Badge>
            )}
          </div>
        )}

        {hasGates && (
          <Field label={t('request.whereTo')} required hint={t('request.whereToHint')}>
            <div className="flex flex-wrap gap-2" data-testid="delivery-where">
              <button
                type="button"
                onClick={() => setPicked('GATE')}
                data-testid="delivery-to-gate"
                className={clsx(
                  'lf-btn !h-9 !px-3 text-xs border',
                  destination === 'GATE'
                    ? 'bg-brand text-brand-fg border-brand'
                    : 'bg-surface border-line text-muted hover:text-brand',
                )}
              >
                {t('request.toExitGate')}
              </button>
              <button
                type="button"
                onClick={() => setPicked('ADDRESS')}
                data-testid="delivery-to-address"
                className={clsx(
                  'lf-btn !h-9 !px-3 text-xs border',
                  destination === 'ADDRESS'
                    ? 'bg-brand text-brand-fg border-brand'
                    : 'bg-surface border-line text-muted hover:text-brand',
                )}
              >
                {t('request.toAddress')}
              </button>
            </div>
          </Field>
        )}

        {destination === 'GATE' ? (
          <Field label={t('request.exitGate')} required hint={t('request.exitGateHint')}>
            <Select
              value={gateId}
              onChange={setGateId}
              options={[
                { label: t('request.pickGate'), value: '' },
                ...gates.map((g) => ({ label: g.location ? `${g.name} — ${g.location}` : g.name, value: g._id })),
              ]}
              testId="delivery-gate"
            />
          </Field>
        ) : (
          <Field
            label={t('request.deliverTo')}
            required
            hint={gatesFailed ? t('request.gatesUnavailable') : hasGates ? t('request.addressHint') : t('request.noGatesHint')}
          >
            <input
              className="lf-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('request.addressPlaceholder')}
              data-testid="delivery-address"
            />
          </Field>
        )}


        <Field label={t('request.notes')} hint={t('request.notesHint')}>
          <textarea
            className="lf-input min-h-[70px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            data-testid="delivery-notes"
          />
        </Field>

        <Field
          label={t('request.contact')}
          hint={customerPhone ? t('request.contactFromBooking') : t('request.contactHint')}
        >
          <PhoneInput value={contactPhone} onChange={setContactPhone} testId="delivery-contact" />
        </Field>

        {needsProof && saidWhere && (
          <Badge tone="warning" className="mt-1">
            <MapPin size={12} className="me-1 inline" />{t('request.verifyToEnable')}</Badge>
        )}
      </Modal>

      <IdentityVerificationModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        bookingId={bookingId}
        customerName={customerName}
        customerEmail={customerEmail}
        purpose="DELIVERY_REQUEST"
        onVerified={() => { setVerified(true); setVerifyOpen(false) }}
      />
    </>
  )
}
