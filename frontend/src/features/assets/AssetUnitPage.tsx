import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Boxes, MapPin, Pencil, QrCode, Tag } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Spinner, StatusBadge } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { RefText } from '@/components/RefLink'
import { AssetQrModal } from './AssetQrModal'
import { WrongDeskBanner } from './WrongDeskBanner'
import { useAssetUnit, useUpdateAssetUnit } from '@/hooks'
import { can } from '@/permissions/permissions'
import { useAuthStore } from '@/store/auth'
import { engineLabel } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'

const SETTABLE = ['AVAILABLE', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED']

export function AssetUnitPage() {
  const { t } = useTranslation(['assets', 'common'])
  const { id } = useParams()
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.me?.role)
  const mayManage = can(role, 'assets.manage')

  const { data, isLoading, isError } = useAssetUnit(id)
  const updateUnit = useUpdateAssetUnit()

  const [qrOpen, setQrOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [note, setNote] = useState('')
  const [ownPrice, setOwnPrice] = useState(false)
  const [unitPrice, setUnitPrice] = useState(0)
  const [ownPenalty, setOwnPenalty] = useState(false)
  const [unitPenalty, setUnitPenalty] = useState(0)

  if (isLoading) {
    return (
      <div data-testid="asset-unit">
        <PageHeader title={t('unit.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div data-testid="asset-unit">
        <PageHeader title={t('unit.title')} crumbs={[{ label: t('common:crumb.assets'), to: '/assets' }, { label: t('common:crumb.notfound') }]} />
        <Card>
          <EmptyState icon={<Boxes size={24} />} title={t('unit.notFound')} message={t('unit.notFoundHint')} />
        </Card>
      </div>
    )
  }

  const openEdit = () => {
    setIdentifier(data.identifier)
    setStatus(SETTABLE.includes(data.status) ? data.status : 'AVAILABLE')
    setNote(data.note)
    setOwnPrice(data.priceOverride !== null)
    setUnitPrice(data.priceOverride ?? data.basePrice ?? 0)
    setOwnPenalty(data.penaltyPrice !== null)
    setUnitPenalty(data.penaltyPrice ?? data.effectivePenalty ?? 0)
    setEditOpen(true)
  }

  const submitEdit = () => {
    const busy = !SETTABLE.includes(data.status)
    updateUnit.mutate(
      {
        id: data._id,
        body: {
          identifier,
          note,
          priceOverride: ownPrice ? unitPrice : null,
          penaltyPrice: ownPenalty ? unitPenalty : null,
          ...(busy || status === data.status ? {} : { status }),
        },
      },
      {
        onSuccess: () => {
          toast('success', t('toast.unitSaved', { identifier }))
          setEditOpen(false)
        },
        onError: (e) => toast('danger', t('toast.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const quickStatus = (next: string) =>
    updateUnit.mutate(
      { id: data._id, body: { status: next } },
      {
        onSuccess: () => toast('success', t('toast.unitSaved', { identifier: data.identifier })),
        onError: (e) => toast('danger', t('toast.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )

  return (
    <div data-testid="asset-unit">
      <PageHeader
        title={data.identifier}
        subtitle={`${data.assetTypeName}${data.engineKind ? ` · ${engineLabel(data.engineKind)}` : ''}`}
        helpId="assets"
        crumbs={[
          { label: t('common:crumb.assets'), to: '/assets' },
          { label: data.assetTypeName, to: `/assets/${data.assetTypeId}` },
          { label: data.identifier },
        ]}
        actions={
          <>
            <Button variant="secondary" onClick={() => setQrOpen(true)} data-testid="asset-unit-qr">
              <QrCode size={16} />{t('unit.qr')}</Button>
            {mayManage && (
              <Button onClick={openEdit} data-testid="asset-unit-edit">
                <Pencil size={16} />{t('common:action.edit')}</Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-3">
          <WrongDeskBanner unitId={data._id} />
        </div>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>{t('unit.state')}</SectionTitle>
            <StatusBadge status={data.status} group="unit" />
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Meta label={t('common:column.identifier')} value={<RefText>{data.identifier}</RefText>} />
            <Meta label={t('common:column.kind')} value={t(`kind.${data.assetTypeKind}`, { defaultValue: data.assetTypeKind ?? '—' })} />
            <Meta label={t('common:column.activity')} value={data.engineKind ? engineLabel(data.engineKind) : '—'} />
            <Meta
              label={t('common:field.station')}
              value={
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-muted" />
                  {data.stationName}
                </span>
              }
            />
            <Meta label={t('common:field.kiosk')} value={data.kioskName ?? '—'} />
            <Meta
              label={t('table.price')}
              value={
                <span className="flex items-center gap-2">
                  {data.effectivePrice === null ? '—' : money(data.effectivePrice)}
                  {data.priceOverride !== null && <Badge tone="warning">{t('table.ownPrice')}</Badge>}
                </span>
              }
            />
            <Meta
              label={t('table.penalty')}
              value={
                <span className="flex items-center gap-2" data-testid="asset-unit-penalty">
                  {data.effectivePenalty === null ? '—' : money(data.effectivePenalty)}
                  {data.penaltyPrice !== null && <Badge tone="warning">{t('table.ownPrice')}</Badge>}
                </span>
              }
            />
          </dl>

          {data.note && (
            <div className="mt-4 lf-card p-3">
              <p className="text-xs uppercase tracking-wide text-muted mb-1">{t('edit.note')}</p>
              <p className="text-sm">{data.note}</p>
            </div>
          )}

          {mayManage && (
            <div className="flex flex-wrap gap-2 mt-5">
              {data.status === 'AVAILABLE' && (
                <Button variant="secondary" onClick={() => quickStatus('OUT_OF_SERVICE')} data-testid="asset-unit-suspend">
                  {t('action.suspend')}
                </Button>
              )}
              {['OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(data.status) && (
                <Button variant="secondary" onClick={() => quickStatus('AVAILABLE')} data-testid="asset-unit-restore">
                  {t('action.restore')}
                </Button>
              )}
              {!SETTABLE.includes(data.status) && (
                <>
                  <Button variant="danger" onClick={() => quickStatus('AVAILABLE')} data-testid="asset-unit-free">
                    {t('action.forceFree')}
                  </Button>
                  <p className="text-xs text-muted self-center">{t('edit.statusLocked', { status: data.status.replaceAll('_', ' ') })}</p>
                </>
              )}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle className="mb-3 flex items-center gap-2">
            <Tag size={18} /> {t('unit.booking')}
          </SectionTitle>
          {data.currentBookingRef ? (
            <div>
              <button
                type="button"
                className="text-brand hover:underline"
                onClick={() => navigate(`/bookings/${data.currentBookingId}`)}
                data-testid="asset-unit-booking"
              >
                <RefText>{data.currentBookingRef}</RefText>
              </button>
              {data.currentBookingStatus && (
                <div className="mt-2">
                  <StatusBadge status={data.currentBookingStatus} group="booking" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('unit.noBooking')}</p>
          )}
        </Card>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('edit.title', { identifier: data.identifier })}
        subtitle={t('edit.subtitle')}
        testId="asset-unit-edit-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitEdit} loading={updateUnit.isPending} disabled={!identifier.trim()} data-testid="asset-unit-edit-submit">
              {t('common:action.save')}
            </Button>
          </>
        }
      >
        <Field label={t('common:column.identifier')} required>
          <input className="lf-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} data-testid="asset-unit-identifier" />
        </Field>
        <Field
          label={t('common:column.status')}
          hint={!SETTABLE.includes(data.status) ? t('edit.statusLocked', { status: data.status.replaceAll('_', ' ') }) : undefined}
        >
          <Select
            value={status}
            onChange={setStatus}
            disabled={!SETTABLE.includes(data.status)}
            options={SETTABLE.map((s) => ({ label: t(`status.${s}`, { defaultValue: s.replaceAll('_', ' ') }), value: s }))}
            testId="asset-unit-status"
          />
        </Field>
        <Field label={t('edit.note')}>
          <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="asset-unit-note" />
        </Field>
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none mb-3">
          <input type="checkbox" className="mt-0.5" checked={ownPrice} onChange={(e) => setOwnPrice(e.target.checked)} data-testid="asset-unit-own-price" />
          <span>{t('edit.ownPrice', { price: data.basePrice === null ? '—' : money(data.basePrice) })}</span>
        </label>
        {ownPrice && (
          <Field label={t('edit.unitPrice')} required>
            <NumberInput min={0} step={0.5} value={unitPrice} onChange={setUnitPrice} testId="asset-unit-price" />
          </Field>
        )}
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none mb-3">
          <input type="checkbox" className="mt-0.5" checked={ownPenalty} onChange={(e) => setOwnPenalty(e.target.checked)} data-testid="asset-unit-own-penalty" />
          <span>{t('edit.ownPenalty', { price: data.effectivePenalty ? money(data.effectivePenalty) : '—' })}</span>
        </label>
        {ownPenalty && (
          <Field label={t('edit.unitPenalty')} required hint={t('edit.unitPenaltyHint')}>
            <NumberInput min={0} step={0.5} value={unitPenalty} onChange={setUnitPenalty} testId="asset-unit-penalty-input" />
          </Field>
        )}
      </Modal>

      <AssetQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        unitId={data._id}
        identifier={data.identifier}
        assetTypeName={data.assetTypeName}
        stationName={data.stationName}
      />
    </div>
  )
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-semibold text-navy dark:text-dk-text mt-0.5">{value}</dd>
    </div>
  )
}
