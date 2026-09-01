import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BellRing, KeyRound, MapPin, ShieldAlert, Truck, UserCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { DataTable } from '@/components/DataTable'
import { Icon } from '@/components/Icon'
import { useDelivery, useStationDeliveries, useStationDeliveryTransition } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { meta, relativeTime } from './deliveryMeta'
import type { Delivery } from '@/api/delivery.api'

const WAITING = 'RELEASE_REQUESTED'

function ApproveModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation('delivery')
  const { data, isLoading } = useDelivery(id ?? undefined, !!id)
  const run = useStationDeliveryTransition()

  const [confirmed, setConfirmed] = useState(false)
  const [code, setCode] = useState('')

  const close = () => { setConfirmed(false); setCode(''); onClose() }

  const approve = () => {
    if (!id || !data?.courier) return
    run.mutate(
      { id, code: 'TO_RELEASE_APPROVED', payload: { confirmCourierId: data.courier._id, compartmentCode: code.trim() } },
      {
        onSuccess: () => {
          toast('success', t('kiosk.released'), `${data.courier?.fullName} can now collect the bags.`)
          close()
        },
        onError: (e) => toast('danger', t('kiosk.notApproved'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const codeValid = /^[A-Za-z0-9]{4,12}$/.test(code.trim())

  return (
    <Modal
      open={!!id}
      onClose={close}
      title={t('kiosk.releaseTitle')}
      subtitle={t('kiosk.checkPerson')}
      size="lg"
      testId="delivery-approve-modal"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button
            onClick={approve}
            loading={run.isPending}
            disabled={!confirmed || !codeValid || !data?.courier}
            data-testid="delivery-approve-submit"
          >
            <KeyRound size={16} />{t('kiosk.approveRelease')}</Button>
        </>
      }
    >
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          <div className="lf-card p-4 mb-4 border-brand/40 bg-brand/5" data-testid="delivery-approve-courier">
            <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2">{t('kiosk.assignedTo')}</p>
            {data.courier ? (
              <>
                <p className="text-xl font-bold text-navy dark:text-dk-texthi">{data.courier.fullName}</p>
                <p className="text-sm text-muted">{data.courier.email}</p>
                {data.courier.phone && <p className="text-sm text-muted">{data.courier.phone}</p>}
              </>
            ) : (
              <p className="text-sm text-danger-strong">{t('kiosk.noCourier')}</p>
            )}
          </div>

          <div className="lf-card p-3 mb-4 flex items-start gap-3 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-navy dark:text-dk-text">
              Approving hands a stranger someone else’s property. If the person at your desk is not the courier named
              above, close this and tell your supervisor.
            </p>
          </div>

          <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-[rgb(var(--brand))]"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              data-testid="delivery-approve-confirm"
            />
            <span className="text-sm text-navy dark:text-dk-text">
              I have checked this courier’s ID and they are{' '}
              <strong>{data.courier?.fullName ?? 'the assigned courier'}</strong>.
            </span>
          </label>

          <Field
            label={`Compartment ${data.delivery.assetUnitIdentifier ?? ''} unlock code`}
            required
            hint={t('kiosk.codeHint')}
          >
            <input
              className="lf-input font-mono tracking-[0.25em] text-lg"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={!confirmed}
              maxLength={12}
              placeholder={t('kiosk.codeFormat')}
              data-testid="delivery-approve-code"
            />
          </Field>

          <div className="text-sm text-muted">
            <p className="font-semibold text-navy dark:text-dk-texthi">{data.delivery.customerName}</p>
            <p>{data.bags.length} bag(s) · booking {data.delivery.bookingId}</p>
            <p className="mt-1 flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" />{data.delivery.destination.address}</p>
          </div>
        </>
      )}
    </Modal>
  )
}

export function KioskDeliveriesPage() {
  const { t } = useTranslation('delivery')
  const { data, isLoading } = useStationDeliveries()
  const [approving, setApproving] = useState<string | null>(null)

  if (isLoading || !data) {
    return (
      <div data-testid="kiosk-deliveries">
        <PageHeader title={t('kiosk.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const waiting = data.filter((d) => d.status === WAITING)
  const open = data.filter((d) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status))
  const inTransit = data.filter((d) => d.status === 'PICKED_UP')

  return (
    <div data-testid="kiosk-deliveries">
      <PageHeader
        title={t('kiosk.title')}
        subtitle={t('kiosk.subtitle')}
        crumbs={[{ label: t('common:crumb.operations') }, { label: 'Deliveries' }]}
        helpId="deliveries"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label={t('kiosk.atYourDesk')} value={waiting.length} icon={<BellRing size={18} />} tone={waiting.length ? 'warning' : 'neutral'} testId="kiosk-stat-waiting" />
        <StatCard label={t('kiosk.openJobs')} value={open.length} icon={<Truck size={18} />} tone="info" testId="kiosk-stat-open" />
        <StatCard label={t('kiosk.inTransit')} value={inTransit.length} icon={<MapPin size={18} />} tone="info" testId="kiosk-stat-transit" />
      </div>

      {waiting.length > 0 && (
        <>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <BellRing size={16} className="text-amber-600" />{t('kiosk.waitingAtDesk')}</SectionTitle>
          <div className="flex flex-col gap-3 mb-6" data-testid="kiosk-waiting">
            {waiting.map((d) => (
              <Card key={d._id} className="p-4 border-amber-300 bg-amber-50/60 dark:bg-amber-900/20" data-testid={`kiosk-waiting-${d._id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <RefText className="text-muted">{d._id}</RefText>
                    <p className="font-semibold text-navy dark:text-dk-texthi">
                      {d.customerName} · {d.assetUnitIdentifier ? `compartment ${d.assetUnitIdentifier}` : 'compartment'}
                    </p>
                    <p className="text-xs text-muted mt-0.5">A courier is asking for these bags — requested {relativeTime(d.releaseRequestedAt)}</p>
                  </div>
                  <Button onClick={() => setApproving(d._id)} data-testid={`kiosk-approve-${d._id}`}>
                    <UserCheck size={16} />{t('kiosk.checkCourier')}</Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle className="mb-2">{t('kiosk.allDeliveries')}</SectionTitle>
      {data.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Truck size={28} />}
            title={t('kiosk.empty')}
            message={t('kiosk.emptyMessage')}
          />
        </Card>
      ) : (
        <DataTable
          testId="kiosk-delivery-table"
          rows={data}
          keyOf={(r: Delivery) => r._id}
          empty={{ title: 'No deliveries', message: '' }}
          columns={[
            {
              key: 'id',
              header: t('common:column.delivery'),
              sortValue: (r: Delivery) => r._id,
              filter: { kind: 'text', value: (r: Delivery) => `${r._id} ${r.customerName}` },
              render: (r: Delivery) => (
                <div>
                  <RefText className="text-muted">{r._id}</RefText>
                  <p className="font-semibold text-navy dark:text-dk-texthi">{r.customerName}</p>
                </div>
              ),
            },
            {
              key: 'dest',
              header: t('common:column.destination'),
              render: (r: Delivery) => <span className="text-sm line-clamp-2 max-w-[280px] block">{r.destination.address}</span>,
            },
            {
              key: 'origin',
              header: t('common:column.raised'),
              filter: {
                kind: 'select',
                options: [
                  { label: t('kiosk.atStorage'), value: 'AT_STORAGE' },
                  { label: t('kiosk.byPhone'), value: 'CUSTOMER_CONTACT' },
                ],
                value: (r: Delivery) => r.origin,
              },
              render: (r: Delivery) => (
                <div className="text-xs">
                  <p>{r.origin === 'AT_STORAGE' ? t('kiosk.atStorage') : t('kiosk.byPhone')}</p>
                  {r.verificationMethod && <p className="text-muted">verified · {r.verificationMethod.replaceAll('_', ' ').toLowerCase()}</p>}
                </div>
              ),
            },
            {
              key: 'status',
              header: t('common:column.status'),
              filter: {
                kind: 'select',
                options: [
                  { label: t('delivery:state.REQUESTED.label'), value: 'REQUESTED' },
                  { label: t('delivery:state.ASSIGNED.label'), value: 'ASSIGNED' },
                  { label: t('delivery:state.RELEASE_REQUESTED.label'), value: 'RELEASE_REQUESTED' },
                  { label: t('delivery:state.RELEASE_APPROVED.label'), value: 'RELEASE_APPROVED' },
                  { label: t('delivery:state.PICKED_UP.label'), value: 'PICKED_UP' },
                  { label: t('delivery:state.DELIVERED.label'), value: 'DELIVERED' },
                  { label: t('delivery:state.FAILED.label'), value: 'FAILED' },
                  { label: t('delivery:state.CANCELLED.label'), value: 'CANCELLED' },
                ],
                value: (r: Delivery) => r.status,
              },
              render: (r: Delivery) => {
                const m = meta(r.status)
                return (
                  <Badge tone={m.tone}>
                    <Icon name={m.icon} size={12} className="me-1 inline" />
                    {t(m.labelKey)}
                  </Badge>
                )
              },
            },
            {
              key: 'when',
              header: t('common:column.requested'),
              align: 'right',
              sortValue: (r: Delivery) => r.requestedAt,
              render: (r: Delivery) => <span className="text-xs text-muted">{relativeTime(r.requestedAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r: Delivery) =>
                r.status === WAITING ? (
                  <Button
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); setApproving(r._id) }}
                    data-testid={`kiosk-row-approve-${r._id}`}
                  >
                    Release
                  </Button>
                ) : (
                  <span className={clsx('text-xs text-muted')}>—</span>
                ),
            },
          ]}
        />
      )}

      <ApproveModal id={approving} onClose={() => setApproving(null)} />
    </div>
  )
}
