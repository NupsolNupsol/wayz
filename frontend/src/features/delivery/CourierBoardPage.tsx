import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/utils'
import { useTranslation } from 'react-i18next'
import { Truck, MapPin, PackageCheck, Hand, Clock, Navigation, TriangleAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { DataTable } from '@/components/DataTable'
import { useCourierBoard, useCourierTransition } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { meta, relativeTime } from './deliveryMeta'
import type { Delivery } from '@/api/delivery.api'

function JobCard({
  job,
  action,
  onOpen,
  accent,
}: {
  job: Delivery
  action?: React.ReactNode
  onOpen: () => void
  accent?: boolean
}) {
  const { t } = useTranslation(['delivery', 'common'])
  const m = meta(job.status)
  return (
    <Card
      className={clsx(
        'p-4 transition-shadow hover:shadow-pop cursor-pointer',
        accent && 'border-brand/50 ring-1 ring-brand/20',
      )}
      onClick={onOpen}
      data-testid={`delivery-card-${job._id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RefText className="text-muted">{job._id}</RefText>
            <Badge tone={m.tone}>
              <Icon name={m.icon} size={12} className="me-1 inline" />
              {t(m.labelKey)}
            </Badge>
          </div>
          <p className="font-semibold text-navy dark:text-dk-texthi mt-1.5 truncate">{job.customerName}</p>
          <p className="text-sm text-muted flex items-start gap-1.5 mt-0.5">
            <MapPin size={14} className="shrink-0 mt-0.5" />
            <span className="line-clamp-2">{job.destination.address}</span>
          </p>
        </div>
        <div className="text-end shrink-0">
          {job.fee > 0 && <p className="font-bold text-navy dark:text-dk-texthi tabular-nums">{job.fee.toFixed(2)}</p>}
          <p className="text-[11px] text-muted flex items-center gap-1 justify-end mt-1">
            <Clock size={11} /> {relativeTime(job.requestedAt)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted mt-3">{t(m.hintKey)}</p>

      {action && (
        <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      )}
    </Card>
  )
}

export function CourierBoardPage() {
  const { t } = useTranslation('delivery')
  const navigate = useNavigate()
  const { data, isLoading } = useCourierBoard()
  const claim = useCourierTransition()

  const open = (id: string) => navigate(`/courier/task/${id}`)

  const claimJob = (job: Delivery) => {
    claim.mutate(
      { id: job._id, code: 'TO_ASSIGNED' },
      {
        onSuccess: () => {
          toast('success', t('board.taskIsYours'), t('board.headToKiosk'))
          open(job._id)
        },
        onError: (e) =>
          toast(
            'warning',
            e instanceof ApiError && e.status === 409 ? 'Someone got there first' : 'Could not pick it up',
            e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '',
          ),
      },
    )
  }

  if (isLoading || !data) {
    return (
      <div data-testid="courier-board">
        <PageHeader title={t('board.title')} subtitle={t('board.loading')} />
        <Spinner />
      </div>
    )
  }

  const carrying = data.mine.filter((j) => j.status === 'PICKED_UP').length
  const deliveredToday = data.history.filter(
    (j) => j.deliveredAt && new Date(j.deliveredAt).toDateString() === new Date().toDateString(),
  ).length

  return (
    <div data-testid="courier-board">
      <PageHeader
        title={t('board.title')}
        subtitle={t('board.subtitle')}
        crumbs={[{ label: t('common:crumb.delivery') }, { label: t('common:crumb.board') }]}
        helpId="courier-board"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label={t('board.openOnSite')} value={data.available.length} icon={<Hand size={18} />} tone="warning" testId="courier-stat-open" />
        <StatCard label={t('board.myTasks')} value={data.mine.length} icon={<Truck size={18} />} tone="info" testId="courier-stat-mine" />
        <StatCard label={t('board.deliveredToday')} value={deliveredToday} icon={<PackageCheck size={18} />} tone="success" testId="courier-stat-done" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <section>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <Navigation size={16} /> {t('board.myTasks')}
            {carrying > 0 && <Badge tone="info">{carrying} in transit</Badge>}
          </SectionTitle>
          {data.mine.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon={<Truck size={28} />} title={t('board.nothingInHand')} message={t('board.nothingInHandMessage')} />
            </Card>
          ) : (
            <div className="flex flex-col gap-3" data-testid="courier-mine">
              {data.mine.map((job) => (
                <JobCard key={job._id} job={job} onOpen={() => open(job._id)} accent
                  action={<Button variant="secondary" data-testid={`delivery-open-${job._id}`}>{t('board.continue')}</Button>} />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle className="mb-2 flex items-center gap-2">
            <Hand size={16} />{t('board.availableAtSite')}</SectionTitle>
          {data.available.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon={<PackageCheck size={28} />} title={t('board.noOpenRequests')} message={t('board.noOpenRequestsMessage')} />
            </Card>
          ) : (
            <div className="flex flex-col gap-3" data-testid="courier-available">
              {data.available.map((job) => (
                <JobCard
                  key={job._id}
                  job={job}
                  onOpen={() => open(job._id)}
                  action={
                    <Button
                      onClick={() => claimJob(job)}
                      loading={claim.isPending && claim.variables?.id === job._id}
                      data-testid={`delivery-claim-${job._id}`}
                    >
                      <Hand size={16} />{t('board.pickUp')}</Button>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export function CourierHistoryPage() {
  const { t } = useTranslation('delivery')
  const navigate = useNavigate()
  const { data, isLoading } = useCourierBoard()

  if (isLoading || !data) {
    return (
      <div data-testid="courier-history">
        <PageHeader title={t('board.completedTitle')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const rows = data.history
  const delivered = rows.filter((r) => r.status === 'DELIVERED').length
  const failed = rows.filter((r) => r.status === 'FAILED').length

  const minutesTaken = (job: Delivery) => {
    if (!job.assignedAt || !(job.deliveredAt ?? job.updatedAt)) return null
    const end = new Date(job.deliveredAt ?? job.updatedAt).getTime()
    return Math.max(0, Math.round((end - new Date(job.assignedAt).getTime()) / 60_000))
  }

  return (
    <div data-testid="courier-history">
      <PageHeader
        title={t('board.completedTitle')}
        subtitle={t('board.completedSubtitle')}
        crumbs={[{ label: t('common:crumb.delivery') }, { label: t('common:label.completed') }]}
        helpId="courier-board"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label={t('board.closed')} value={rows.length} icon={<PackageCheck size={18} />} tone="neutral" testId="history-stat-total" />
        <StatCard label={t('board.delivered')} value={delivered} icon={<PackageCheck size={18} />} tone="success" testId="history-stat-delivered" />
        <StatCard label={t('board.failed')} value={failed} icon={<TriangleAlert size={18} />} tone={failed ? 'danger' : 'neutral'} testId="history-stat-failed" />
      </div>

      <DataTable
        testId="courier-history-table"
        rows={rows}
        keyOf={(r: Delivery) => r._id}
        onRowClick={(r: Delivery) => navigate(`/courier/task/${r._id}`)}
        initialSort={{ key: 'closed', dir: 'desc' }}
        empty={{ title: 'Nothing yet', message: 'Delivered and failed tasks are kept here.' }}
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
            key: 'destination',
            header: t('common:column.destination'),
            sortValue: (r: Delivery) => r.destination.address,
            filter: { kind: 'text', value: (r: Delivery) => r.destination.address },
            render: (r: Delivery) => <span className="text-sm line-clamp-2 max-w-[300px] block">{r.destination.address}</span>,
          },
          {
            key: 'bags',
            header: t('common:column.bags'),
            align: 'right',
            sortValue: (r: Delivery) => r.scannedBarcodes.length,
            render: (r: Delivery) => <span className="tabular-nums">{r.scannedBarcodes.length || '—'}</span>,
          },
          {
            key: 'status',
            header: t('common:column.outcome'),
            filter: {
              kind: 'select',
              options: [
                { label: t('delivery:state.DELIVERED.label'), value: 'DELIVERED' },
                { label: t('delivery:state.FAILED.label'), value: 'FAILED' },
                { label: t('delivery:state.CANCELLED.label'), value: 'CANCELLED' },
              ],
              value: (r: Delivery) => r.status,
            },
            sortValue: (r: Delivery) => r.status,
            render: (r: Delivery) => {
              const m = meta(r.status)
              return (
                <div>
                  <Badge tone={m.tone}>
                    <Icon name={m.icon} size={12} className="me-1 inline" />
                    {t(m.labelKey)}
                  </Badge>
                  {r.failureReason && <p className="text-[11px] text-muted mt-1 max-w-[220px] line-clamp-2">{r.failureReason}</p>}
                </div>
              )
            },
          },
          {
            key: 'took',
            header: t('common:column.took'),
            align: 'right',
            sortValue: (r: Delivery) => minutesTaken(r) ?? -1,
            render: (r: Delivery) => {
              const mins = minutesTaken(r)
              return <span className="tabular-nums text-sm">{mins === null ? '—' : t('common:unit.minutes', { count: mins })}</span>
            },
          },
          {
            key: 'closed',
            header: t('common:column.closed'),
            align: 'right',
            sortValue: (r: Delivery) => r.deliveredAt ?? r.updatedAt,
            render: (r: Delivery) => (
              <div className="text-end">
                <p className="text-sm">{formatDate(new Date(r.deliveredAt ?? r.updatedAt).getTime())}</p>
                <p className="text-[11px] text-muted">{relativeTime(r.deliveredAt ?? r.updatedAt)}</p>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
