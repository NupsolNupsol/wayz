import { PageHeader } from '@/components/PageHeader'
import { useTranslation } from 'react-i18next'
import { Card, StatusBadge, Spinner, Button } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Timer } from '@/components/Timer'
import { useManagerIncidents, useManagerLiveSessions, useManagerShifts, useManagerUpdateIncident } from '@/hooks'
import { ENGINE_META, engineLabel } from '@/config/engineMeta'
import { formatDateTime, money } from '@/utils'
import { toast } from '@/state/toastStore'
import type { EngineKind } from '@/api/types'
import { RefLink, RefText } from '@/components/RefLink'

const NEXT: Record<string, string | null> = {
  REPORTED: 'INVESTIGATING',
  INVESTIGATING: 'AWAITING_APPROVAL',
  AWAITING_APPROVAL: 'RESOLVED',
  RESOLVED: null,
  REJECTED: null,
}

export function ManagerLive() {
  const { t } = useTranslation(['manager', 'common'])
  const { data = [], isLoading } = useManagerLiveSessions()
  return (
    <div data-testid="manager-live">
      <PageHeader title={t('operations.liveSessions')} subtitle={t('operations.liveSubtitle')} crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.livesessions') }]} />
      {isLoading ? <Spinner /> : (
        <DataTable
          testId="mgr-live-table"
          rows={data}
          keyOf={(r) => r._id}
          empty={{ title: t('operations.nothingRunning'), message: t('operations.nothingRunningHint') }}
          columns={[
            { key: 'ref', header: t('common:column.reference'), sortValue: (r) => r.ref, filter: { kind: 'text', value: (r) => r.ref }, render: (r) => <RefLink to={`/manager/rentals/${r._id}`}>{r.ref}</RefLink> },
            { key: 'service', header: t('common:column.service'), filter: { kind: 'select', options: Object.keys(ENGINE_META).map((e) => ({ label: engineLabel(e as EngineKind), value: e })), value: (r) => r.engineKind }, render: (r) => engineLabel(r.engineKind) },
            { key: 'customer', header: t('common:column.customer'), filter: { kind: 'text', value: (r) => r.customerName }, render: (r) => r.customerName || '—' },
            { key: 'station', header: t('common:column.station'), filter: { kind: 'text', value: (r) => r.stationName }, render: (r) => <span className="text-muted">{r.stationName}</span> },
            { key: 'status', header: t('common:column.status'), sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
            { key: 'remaining', header: t('common:column.remaining'), align: 'right', sortValue: (r) => r.remainingMs ?? 0, render: (r) => <Timer expectedEndAt={r.expectedEndAt} /> },
            { key: 'penalty', header: t('common:column.penalty'), align: 'right', sortValue: (r) => r.penaltyAmount, render: (r) => r.penaltyAmount > 0 ? <strong className="text-danger-strong">{money(r.penaltyAmount)}</strong> : <span className="text-muted">—</span> },
          ]}
        />
      )}
    </div>
  )
}

export function ManagerIncidents() {
  const { t } = useTranslation(['manager', 'common'])
  const { data = [], isLoading } = useManagerIncidents()
  const update = useManagerUpdateIncident()

  const advance = (id: string, status: string) => {
    const next = NEXT[status]
    if (!next) return
    update.mutate({ id, status: next }, { onSuccess: () => toast('info', t('operations.incidentUpdated'), next) })
  }

  return (
    <div data-testid="manager-incidents">
      <PageHeader title={t('operations.incidents')} subtitle={t('operations.incidentsSubtitle')} crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.incidents') }]} />
      {isLoading ? <Spinner /> : (
        <DataTable
          testId="mgr-incidents-table"
          rows={data}
          keyOf={(r) => r._id}
          empty={{ title: t('operations.noIncidents'), message: t('operations.noIncidentsHint') }}
          columns={[
            { key: 'ref', header: t('common:column.reference'), sortValue: (r) => r.ref, filter: { kind: 'text', value: (r) => r.ref }, render: (r) => <RefText>{r.ref}</RefText> },
            { key: 'type', header: t('common:column.type'), filter: { kind: 'text', value: (r) => r.type }, render: (r) => r.type.replaceAll('_', ' ') },
            { key: 'service', header: t('common:column.service'), render: (r) => r.engineKind ? (engineLabel(r.engineKind)) : '—' },
            { key: 'station', header: t('common:column.station'), filter: { kind: 'text', value: (r) => r.stationName }, render: (r) => <span className="text-muted">{r.stationName}</span> },
            { key: 'desc', header: t('common:column.description'), render: (r) => <span className="text-muted line-clamp-1">{r.description}</span> },
            { key: 'status', header: t('common:column.status'), filter: { kind: 'select', options: ['REPORTED', 'INVESTIGATING', 'AWAITING_APPROVAL', 'RESOLVED', 'REJECTED'].map((s) => ({ label: s.replaceAll('_', ' '), value: s })), value: (r) => r.status }, render: (r) => <StatusBadge status={r.status} /> },
            { key: 'date', header: t('common:column.reported'), align: 'right', sortValue: (r) => new Date(r.createdAt).getTime(), render: (r) => <span className="text-muted">{formatDateTime(new Date(r.createdAt).getTime())}</span> },
            { key: 'action', header: '', align: 'right', render: (r) => NEXT[r.status] ? <Button variant="ghost" onClick={(e) => { e.stopPropagation(); advance(r._id, r.status) }}>→ {NEXT[r.status]?.replaceAll('_', ' ')}</Button> : null },
          ]}
        />
      )}
    </div>
  )
}

export function ManagerShifts() {
  const { t } = useTranslation(['manager', 'common'])
  const { data = [], isLoading } = useManagerShifts()
  const reconciling = data.filter((s) => s.status === 'RECONCILING')

  return (
    <div data-testid="manager-shifts">
      <PageHeader title={t('operations.shifts')} subtitle={t('operations.shiftsSubtitle')} crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.shifts') }]} />

      {reconciling.length > 0 && (
        <Card className="mb-5 border-amber-400/60 bg-amber-50 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {reconciling.length} shift(s) awaiting variance approval
          </p>
          <p className="text-xs text-muted mt-1">{t('operations.blindCountNote')}</p>
        </Card>
      )}

      {isLoading ? <Spinner /> : (
        <DataTable
          testId="mgr-shifts-table"
          rows={data}
          keyOf={(r) => r._id}
          empty={{ title: t('operations.noShifts'), message: t('operations.noShiftsHint') }}
          columns={[
            { key: 'agent', header: t('common:column.agent'), filter: { kind: 'text', value: (r) => r.agentName }, render: (r) => r.agentName },
            { key: 'station', header: t('common:column.station'), filter: { kind: 'text', value: (r) => r.stationName }, render: (r) => <span className="text-muted">{r.stationName}</span> },
            { key: 'opened', header: t('common:column.opened'), sortValue: (r) => new Date(r.openedAt).getTime(), render: (r) => formatDateTime(new Date(r.openedAt).getTime()) },
            { key: 'expected', header: t('common:column.expected'), align: 'right', sortValue: (r) => r.expectedCash, render: (r) => money(r.expectedCash) },
            { key: 'counted', header: t('common:column.counted'), align: 'right', render: (r) => r.countedCash != null ? money(r.countedCash) : <span className="text-muted">—</span> },
            { key: 'variance', header: t('common:column.variance'), align: 'right', sortValue: (r) => r.variance ?? 0, render: (r) => r.variance == null ? <span className="text-muted">—</span> : r.variance === 0 ? <span className="text-success">0.00</span> : <strong className="text-danger-strong">{money(r.variance)}</strong> },
            { key: 'status', header: t('common:column.status'), filter: { kind: 'select', options: ['OPEN', 'RECONCILING', 'CLOSED'].map((s) => ({ label: s, value: s })), value: (r) => r.status }, render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
    </div>
  )
}
