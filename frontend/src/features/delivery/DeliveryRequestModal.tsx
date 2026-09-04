import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, ShieldCheck, Truck, Phone, CircleCheck, PackageSearch } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from '@/components/Modal'
import { Button, Field, Badge } from '@/components/ui'
import { IdentityVerificationModal } from '@/components/IdentityVerification'
import { useCreateDelivery, useCustomerBagsElsewhere } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import type { DeliveryOrigin } from '@/api/delivery.api'
import { PhoneInput } from '@/components/PhoneInput'
import { NumberInput } from '@/components/NumberInput'

const ORIGINS: { value: DeliveryOrigin; title: string; blurb: string; icon: typeof MapPin }[] = [
  {
    value: 'AT_STORAGE',
    title: 'Customer is here',
    blurb: 'They are at the desk asking now — no extra check needed.',
    icon: CircleCheck,
  },
  {
    value: 'CUSTOMER_CONTACT',
    title: 'They called or messaged',
    blurb: 'Verify them before the bags are promised to anyone.',
    icon: Phone,
  },
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

  const [origin, setOrigin] = useState<DeliveryOrigin>('AT_STORAGE')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [contactPhone, setContactPhone] = useState(customerPhone ?? '')
  const [fee, setFee] = useState(0)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verified, setVerified] = useState(false)
  const [alsoBookingIds, setAlsoBookingIds] = useState<string[]>([])

  const reset = () => {
    setOrigin('AT_STORAGE'); setAddress(''); setNotes(''); setContactPhone(customerPhone ?? ''); setVerified(false); setFee(0)
    setAlsoBookingIds([])
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
  const ready = address.trim().length >= 3 && !needsProof

  const submit = () => {
    create.mutate(
      {
        bookingId,
        alsoBookingIds: alsoBookingIds.length ? alsoBookingIds : undefined,
        address: address.trim(),
        notes: notes.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        origin,
        fee,
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
                  <Ico size={16} className={active ? 'text-brand' : 'text-muted'} /> {o.title}
                </p>
                <p className="text-xs text-muted mt-1">{o.blurb}</p>
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

        <Field label={t('request.deliverTo')} required hint={t('request.addressHint')}>
          <input
            className="lf-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('request.addressPlaceholder')}
            data-testid="delivery-address"
          />
        </Field>

        <Field label={t('request.fee')} hint={t('request.feeHint')}>
          <NumberInput value={fee} onChange={setFee} min={0} step={5} testId="delivery-fee" />
        </Field>

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
          hint={
            customerPhone
              ? 'Taken from the booking. Change it if the courier should call somebody else.'
              : 'The number the courier calls when they arrive.'
          }
        >
          <PhoneInput value={contactPhone} onChange={setContactPhone} testId="delivery-contact" />
        </Field>

        {needsProof && address.trim().length >= 3 && (
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
