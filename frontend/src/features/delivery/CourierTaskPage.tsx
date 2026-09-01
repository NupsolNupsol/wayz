import { useEffect, useMemo, useState } from 'react'
import { formatDateTime } from '@/utils'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Hand,
  KeyRound,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  ScanLine,
  TriangleAlert,
  Truck,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Field, SectionTitle, Spinner } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Stepper } from '@/components/Stepper'
import { Icon } from '@/components/Icon'
import { useCourierTransition, useDelivery } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { DELIVERY_STEPS, meta, mmss, relativeTime, secondsLeft } from './deliveryMeta'
import type { DeliveryBag, DeliveryDetail } from '@/api/delivery.api'

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function CompartmentCode({
  code,
  expiresAt,
  unit,
  expired,
  onAskAgain,
  asking,
}: {
  code: string
  expiresAt: string | null
  unit: string | null
  expired: boolean
  onAskAgain: () => void
  asking: boolean
}) {
  const { t } = useTranslation('delivery')
  const now = useNow()
  const left = secondsLeft(expiresAt, now)

  return (
    <Card
      className={clsx(
        'p-5 text-center',
        expired ? 'border-danger-strong/40 bg-red-50 dark:bg-red-900/20' : 'border-brand/50 bg-brand/5',
      )}
      data-testid="courier-compartment-code"
    >
      <p className="text-xs uppercase tracking-wider text-muted font-bold flex items-center justify-center gap-1.5">
        <KeyRound size={13} /> Compartment {unit ?? ''} code
      </p>
      <p
        className={clsx('font-mono font-bold tracking-[0.3em] my-2', expired ? 'text-danger-strong text-3xl' : 'text-navy dark:text-dk-texthi text-4xl')}
        data-testid="courier-code-value"
      >
        {expired ? '——————' : code}
      </p>
      {expired ? (
        <>
          <p className="text-xs text-danger-strong mb-3">{t('task.expired')}</p>
          <Button onClick={onAskAgain} loading={asking} data-testid="courier-ask-again">
            <RefreshCw size={16} />{t('task.askAgain')}</Button>
        </>
      ) : (
        <p className="text-xs text-muted">{t('task.expiresIn')}<span className="font-semibold tabular-nums">{mmss(left)}</span>
        </p>
      )}
    </Card>
  )
}

function BlindScanPanel({
  bags,
  demoScanner,
  onConfirm,
  pending,
}: {
  bags: DeliveryBag[]
  demoScanner: boolean
  onConfirm: (barcodes: string[]) => void
  pending: boolean
}) {
  const { t } = useTranslation('delivery')
  const [scans, setScans] = useState<string[]>([])
  const [entry, setEntry] = useState('')

  const add = (raw: string) => {
    const code = raw.trim()
    if (!code) return
    if (scans.includes(code)) {
      toast('warning', t('task.alreadyScanned'), t('task.scanOnce'))
      setEntry('')
      return
    }
    setScans((s) => [...s, code])
    setEntry('')
  }

  const rowDone = (bag: DeliveryBag, i: number) =>
    bag.demoScan ? scans.includes(bag.demoScan) : i < scans.length

  const complete = scans.length === bags.length

  return (
    <div data-testid="courier-scan-panel">
      <p className="text-sm text-muted mb-3">
        Scan every bag as you take it out. The kiosk knows which codes belong to this customer —
        if one does not match, the collection is refused.
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {bags.map((b, i) => {
          const done = rowDone(b, i)
          return (
            <div
              key={b.index}
              className={clsx(
                'lf-card p-3 flex items-center justify-between gap-3 text-sm',
                done && 'border-success bg-emerald-50 dark:bg-emerald-900/20',
              )}
              data-testid={`courier-bag-slot-${b.index}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                {done ? <Check size={16} className="text-success shrink-0" /> : <Package size={16} className="text-muted shrink-0" />}
                <span className="truncate">Bag {b.index} · {b.description || 'Bag'}</span>
              </span>

              {done ? (
                <span className="text-xs text-success font-medium shrink-0">scanned</span>
              ) : b.demoScan ? (
                <Button
                  variant="secondary"
                  className="!h-8 !px-3 shrink-0"
                  onClick={() => add(b.demoScan!)}
                  data-testid={`courier-scan-bag-${b.index}`}
                >
                  <ScanLine size={14} /> Scan
                </Button>
              ) : (
                <span className="text-xs text-muted shrink-0">waiting</span>
              )}
            </div>
          )
        })}
      </div>

      {demoScanner && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button
            variant="ghost"
            onClick={() => bags.forEach((b) => b.demoScan && !scans.includes(b.demoScan) && add(b.demoScan))}
            disabled={complete}
            data-testid="courier-scan-all"
          >
            <ScanLine size={15} />{t('task.scanAll')}</Button>
          <span className="text-[11px] text-muted">{t('task.demoScanner')}</span>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input
          className="lf-input font-mono"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add(entry)}
          placeholder={t('task.scanPlaceholder')}
          data-testid="courier-scan-input"
        />
        <Button variant="secondary" onClick={() => add(entry)} disabled={!entry.trim()} data-testid="courier-scan-add">
          Add
        </Button>
      </div>

      {scans.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3" data-testid="courier-scan-list">
          {scans.map((code) => (
            <Badge key={code} tone="info" className="font-mono">
              {code}
              <button
                className="ms-1.5 opacity-60 hover:opacity-100"
                onClick={() => setScans((prev) => prev.filter((x) => x !== code))}
                aria-label={`Remove scan ${code}`}
              >
                <X size={11} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted mb-3 tabular-nums">
        {scans.length} of {bags.length} scanned
      </p>

      <Button
        className="w-full"
        onClick={() => onConfirm(scans)}
        loading={pending}
        disabled={!complete}
        data-testid="courier-confirm-pickup"
      >
        <PackageCheck size={16} />{t('task.confirmCollected')}</Button>
    </div>
  )
}

export function CourierTaskPage() {
  const { t } = useTranslation('delivery')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useDelivery(id)
  const run = useCourierTransition()

  const [failOpen, setFailOpen] = useState(false)
  const [reason, setReason] = useState('')
  const now = useNow()

  const fire = (code: string, payload?: Parameters<typeof run.mutate>[0]['payload'], success?: string) => {
    if (!id) return
    run.mutate(
      { id, code, payload },
      {
        onSuccess: () => success && toast('success', success),
        onError: (e) => toast('danger', t('task.couldNotContinue'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const detail = data as DeliveryDetail | undefined
  const step = useMemo(() => (detail ? meta(detail.delivery.status).step : 0), [detail])

  if (isLoading || !detail) {
    return (
      <div data-testid="courier-task">
        <PageHeader title={t('task.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const d = detail.delivery
  const m = meta(d.status)
  const mine = detail.mine !== false
  const can = (code: string) => detail.transitions.some((t) => t.code === code)
  const codeExpired = d.status === 'RELEASE_APPROVED' && secondsLeft(d.compartmentCodeExpiresAt, now) === 0

  return (
    <div data-testid="courier-task">
      <PageHeader
        title={d._id}
        subtitle={`${d.customerName} · ${t('common:unit.bags', { count: detail.bags.length })}`}
        crumbs={[{ label: t('common:crumb.delivery'), to: '/courier' }, { label: d._id }]}
        helpId="courier-board"
        actions={
          <Button variant="ghost" onClick={() => navigate('/courier')} data-testid="courier-back">
            <ArrowLeft size={16} />{t('task.board')}</Button>
        }
      />

      <Card className="p-4 mb-5">
        <Stepper steps={[...DELIVERY_STEPS]} current={Math.max(0, step)} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 flex flex-col gap-5">

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <MapPin size={18} className="text-brand shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-navy dark:text-dk-texthi">{d.destination.address}</p>
            {d.destination.notes && <p className="text-sm text-muted mt-1">{d.destination.notes}</p>}
            <div className="flex items-center gap-3 mt-2 text-sm">
              <a
                href={`tel:${d.destination.contactPhone || d.customerPhone}`}
                className="text-brand no-underline flex items-center gap-1.5 hover:underline"
                data-testid="courier-call-customer"
              >
                <Phone size={14} /> {d.destination.contactPhone || d.customerPhone}
              </a>
              <Badge tone={m.tone}>
                <Icon name={m.icon} size={12} className="me-1 inline" />
                {t(m.labelKey)}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <div>
      <SectionTitle className="mb-2">{t('task.nextStep')}</SectionTitle>
      <Card className="p-5" data-testid="courier-action-panel">
        {!mine && (
          <p className="text-sm text-muted" data-testid="courier-not-mine">{t('task.notMine')}</p>
        )}

        {mine && d.status === 'REQUESTED' && (
          <>
            <p className="text-sm text-muted mb-4">{t('task.openToEveryone')}</p>
            <Button className="w-full" onClick={() => fire('TO_ASSIGNED', undefined, 'Task is yours')} loading={run.isPending} data-testid="courier-claim">
              <Hand size={16} />{t('task.pickUp')}</Button>
          </>
        )}

        {mine && d.status === 'ASSIGNED' && (
          <>
            <p className="text-sm text-muted mb-1">
              Go to <strong className="text-navy dark:text-dk-texthi">{d.assetUnitIdentifier ? `compartment ${d.assetUnitIdentifier}` : 'the kiosk'}</strong> and ask the
              agent for the bags.
            </p>
            <p className="text-xs text-muted mb-4">{t('task.agentWillCheck')}</p>
            <Button className="w-full" onClick={() => fire('TO_RELEASE_REQUESTED', undefined, 'The agent has been notified')} loading={run.isPending} data-testid="courier-request-release">
              <Truck size={16} />{t('task.requestBags')}</Button>
          </>
        )}

        {mine && d.status === 'RELEASE_REQUESTED' && (
          <div className="text-center py-2" data-testid="courier-waiting">
            <div className="inline-flex w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 items-center justify-center mb-3">
              <Truck size={22} className="text-amber-600 dark:text-amber-300" />
            </div>
            <p className="font-semibold text-navy dark:text-dk-texthi">{t('task.waitingForAgent')}</p>
            <p className="text-sm text-muted mt-1">{t('task.showThemYourName')}</p>
            <p className="text-xs text-muted mt-3">Requested {relativeTime(d.releaseRequestedAt)}</p>
          </div>
        )}

        {mine && d.status === 'RELEASE_APPROVED' && (
          <>
            <CompartmentCode
              code={d.compartmentCode ?? ''}
              expiresAt={d.compartmentCodeExpiresAt}
              unit={d.assetUnitIdentifier}
              expired={codeExpired}
              asking={run.isPending}
              onAskAgain={() => fire('TO_RELEASE_REQUESTED', undefined, 'The agent has been asked again')}
            />
            {!codeExpired && (
              <>
                <div className="h-4" />
                <BlindScanPanel
                  bags={detail.bags}
                  demoScanner={detail.demoScanner}
                  pending={run.isPending}
                  onConfirm={(barcodes) => fire('TO_PICKED_UP', { scannedBarcodes: barcodes }, 'Bags collected')}
                />
              </>
            )}
          </>
        )}

        {mine && d.status === 'PICKED_UP' && (
          <>
            <p className="text-sm text-muted mb-4">
              You are carrying {detail.bags.length} bag{detail.bags.length === 1 ? '' : 's'}. Hand them to the customer at the
              address above, then close the task.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-1" variant="success" onClick={() => fire('TO_DELIVERED', undefined, 'Delivered — nice work')} loading={run.isPending} data-testid="courier-deliver">
                <PackageCheck size={16} />{t('task.markDelivered')}</Button>
              <Button variant="ghost" onClick={() => setFailOpen(true)} data-testid="courier-report-problem">
                <TriangleAlert size={16} />{t('task.reportProblem')}</Button>
            </div>
          </>
        )}

        {['DELIVERED', 'FAILED', 'CANCELLED'].includes(d.status) && (
          <div className="text-center py-2">
            <div
              className={clsx(
                'inline-flex w-12 h-12 rounded-full items-center justify-center mb-3',
                d.status === 'DELIVERED' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-dk-elevated',
              )}
            >
              <Icon name={m.icon} size={22} className={d.status === 'DELIVERED' ? 'text-success' : 'text-muted'} />
            </div>
            <p className="font-semibold text-navy dark:text-dk-texthi">{t(m.labelKey)}</p>
            <p className="text-sm text-muted mt-1">{d.failureReason || t(m.hintKey)}</p>
          </div>
        )}

        {can('TO_CANCELLED') && (
          <button
            className="w-full mt-4 text-xs text-muted hover:text-danger-strong"
            onClick={() => setFailOpen(true)}
            data-testid="courier-cancel"
          >{t('task.cannotDo')}</button>
        )}
      </Card>
      </div>
      </div>

      <div>
        <SectionTitle className="mb-2">{t('task.activity')}</SectionTitle>
        <Card className="p-4" data-testid="courier-timeline">
          <ol className="relative border-s border-line dark:border-dk-border ms-2">
            {d.timeline.map((entry, i) => (
              <li key={i} className="ms-4 pb-4 last:pb-0">
                <span className="absolute -start-[5px] w-2.5 h-2.5 rounded-full bg-brand" />
                <p className="text-sm font-medium text-navy dark:text-dk-texthi">{t(meta(entry.status).labelKey)}</p>
                {entry.note && <p className="text-xs text-muted">{entry.note}</p>}
                <p className="text-[11px] text-muted mt-0.5">{formatDateTime(new Date(entry.at).getTime())}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      </div>

      <Modal
        open={failOpen}
        onClose={() => { setFailOpen(false); setReason('') }}
        title={d.status === 'PICKED_UP' ? 'Report a problem' : 'Give up this task'}
        subtitle={
          d.status === 'PICKED_UP'
            ? 'You are holding the customer’s bags — say what happened so the kiosk can act on it.'
            : 'The task goes back to the board for another courier.'
        }
        testId="courier-fail-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setFailOpen(false); setReason('') }}>Back</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={run.isPending}
              data-testid="courier-fail-submit"
              onClick={() => {
                fire(d.status === 'PICKED_UP' ? 'TO_FAILED' : 'TO_CANCELLED', { reason: reason.trim() }, 'Recorded')
                setFailOpen(false)
                setReason('')
              }}
            >
              Submit
            </Button>
          </>
        }
      >
        <Field label={t('task.whatHappened')} required hint={t('task.auditNote')}>
          <textarea
            className="lf-input min-h-[90px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('task.failPlaceholder')}
            data-testid="courier-fail-reason"
          />
        </Field>
      </Modal>
    </div>
  )
}
