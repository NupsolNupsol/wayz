import { Users, ScrollText, ShieldCheck } from 'lucide-react'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { formatDateTime } from '@/utils'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Button, Card, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { useTenantAudit, useTenantIsolation, useTenantOverview, useTenantPeople } from '@/hooks'
import type { Role } from '@/api/types'
import type { IsolationReport, TenantAuditRow, TenantPerson } from '@/api/admin.api'

const ROLE_OPTIONS: Role[] = ['TENANT_ADMIN', 'MANAGER', 'ACCOUNTANT', 'HR', 'AGENT', 'CASHIER', 'DELIVERY_AGENT']

export function AdminPeople() {
  const { t } = useTranslation(['admin', 'common'])
  const statusLabel = useStatusLabel()
  const navigate = useNavigate()
  const { data: rows = [], isLoading } = useTenantPeople()

  if (isLoading) {
    return (
      <div data-testid="admin-people">
        <PageHeader title={t('people.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const active = rows.filter((r) => r.active).length
  const onShift = rows.filter((r) => r.onShift).length

  return (
    <div data-testid="admin-people">
      <PageHeader
        title={t('people.title')}
        subtitle={t('people.subtitle')}
        crumbs={[{ label: t('common:crumb.tenantadmin') }, { label: t('people.employees') }]}
        helpId="admin-people"
        actions={
          <Button variant="secondary" onClick={() => navigate('/manager/team')} data-testid="admin-people-manage">{t('people.createOrEdit')}</Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label={t('people.title')} value={rows.length} icon={<Users size={18} />} tone="neutral" testId="ap-stat-total" />
        <StatCard label={t('common:state.active')} value={active} icon={<ShieldCheck size={18} />} tone="success" testId="ap-stat-active" />
        <StatCard label={t('people.onShiftNow')} value={onShift} icon={<Users size={18} />} tone="info" testId="ap-stat-onshift" />
      </div>

      <DataTable
        testId="admin-people-table"
        rows={rows}
        keyOf={(r: TenantPerson) => r._id}
        empty={{ title: t('people.noEmployees'), message: t('people.noEmployeesHint') }}
        columns={[
          {
            key: 'who',
            header: t('common:column.person'),
            sortValue: (r: TenantPerson) => r.fullName,
            filter: { kind: 'text', value: (r: TenantPerson) => `${r.fullName} ${r.email} ${r.phone}` },
            render: (r: TenantPerson) => (
              <div>
                <p className="font-semibold text-navy dark:text-dk-texthi">{r.fullName}</p>
                <p className="text-xs text-muted">{r.email}</p>
              </div>
            ),
          },
          {
            key: 'role',
            header: t('common:column.role'),
            sortValue: (r: TenantPerson) => r.role,
            filter: { kind: 'select', options: ROLE_OPTIONS.map((value) => ({ label: t(`common:role.${value}`), value })), value: (r: TenantPerson) => r.role },
            render: (r: TenantPerson) => <Badge tone="neutral">{t(`common:role.${r.role}`)}</Badge>,
          },
          {
            key: 'where',
            header: t('common:column.assignedto'),
            filter: { kind: 'text', value: (r: TenantPerson) => `${r.stationName} ${r.kioskName ?? ''}` },
            render: (r: TenantPerson) => (
              <div>
                <p className="text-sm">{r.stationName}</p>
                {r.kioskName && <p className="text-[11px] text-muted">{t('common:field.kiosk')} · {r.kioskName}</p>}
              </div>
            ),
          },
          {
            key: 'shift',
            header: t('common:column.shift'),
            render: (r: TenantPerson) =>
              r.onShift ? <Badge tone={r.shiftStatus === 'RECONCILING' ? 'danger' : 'success'}>{statusLabel(r.shiftStatus ?? '', 'shift')}</Badge> : <span className="text-muted">—</span>,
          },
          {
            key: 'handled',
            header: t('common:column.bookings'),
            align: 'right',
            sortValue: (r: TenantPerson) => r.bookingsHandled,
            render: (r: TenantPerson) => <span className="tabular-nums">{r.bookingsHandled}</span>,
          },
          {
            key: 'seen',
            header: t('common:column.lastseen'),
            align: 'right',
            sortValue: (r: TenantPerson) => r.lastLoginAt ?? '',
            render: (r: TenantPerson) => (
              <span className="text-xs text-muted">{r.lastLoginAt ? formatDateTime(new Date(r.lastLoginAt).getTime()) : t('common:state.never')}</span>
            ),
          },
          {
            key: 'status',
            header: t('common:column.status'),
            filter: { kind: 'select', options: [{ label: t('common:label.active'), value: 'yes' }, { label: t('common:label.suspended'), value: 'no' }], value: (r: TenantPerson) => (r.active ? 'yes' : 'no') },
            render: (r: TenantPerson) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? t('common:state.active') : t('common:state.suspended')}</Badge>,
          },
        ]}
      />
    </div>
  )
}

export function AdminAudit() {
  const { t } = useTranslation(['admin', 'common'])
  const { data: rows = [], isLoading } = useTenantAudit()

  if (isLoading) {
    return (
      <div data-testid="admin-audit">
        <PageHeader title={t('people.audit')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  return (
    <div data-testid="admin-audit">
      <PageHeader
        title={t('people.audit')}
        subtitle={t('people.auditSubtitle')}
        crumbs={[{ label: t('common:crumb.tenantadmin') }, { label: t('common:crumb.audit') }]}
        helpId="admin-audit"
      />

      <DataTable
        testId="admin-audit-table"
        rows={rows}
        keyOf={(r: TenantAuditRow) => r._id}
        initialSort={{ key: 'when', dir: 'desc' }}
        pageSize={15}
        empty={{ title: t('people.noAudit'), message: t('people.noAuditHint') }}
        columns={[
          {
            key: 'action',
            header: t('common:column.action'),
            sortValue: (r: TenantAuditRow) => r.action,
            filter: { kind: 'text', value: (r: TenantAuditRow) => `${r.action} ${r.actorName} ${r.detail ?? ''} ${r.reason ?? ''}` },
            render: (r: TenantAuditRow) => (
              <div>
                <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-1.5">
                  <ScrollText size={14} className="text-muted" /> {t(`status:auditAction.${r.action}`, { defaultValue: r.action.replaceAll('_', ' ').toLowerCase() })}
                </p>
                {r.detail && <p className="text-xs text-muted font-mono max-w-[280px] truncate">{r.detail}</p>}
              </div>
            ),
          },
          {
            key: 'entity',
            header: t('common:column.on'),
            filter: { kind: 'select', options: [...new Set(rows.map((r: TenantAuditRow) => r.entity))].map((e) => ({ label: t(`status:entity.${e}`, { defaultValue: e }), value: e })), value: (r: TenantAuditRow) => r.entity },
            render: (r: TenantAuditRow) => <Badge tone="neutral">{t(`status:entity.${r.entity}`, { defaultValue: r.entity })}</Badge>,
          },
          {
            key: 'reference',
            header: t('common:column.reference'),
            filter: { kind: 'text', value: (r: TenantAuditRow) => r.entityId },
            render: (r: TenantAuditRow) => <RefText>{r.entityId}</RefText>,
          },
          {
            key: 'by',
            header: t('common:column.by'),
            sortValue: (r: TenantAuditRow) => r.actorName,
            filter: { kind: 'select', options: [...new Set(rows.map((r: TenantAuditRow) => r.actorName))].map((n) => ({ label: n, value: n })), value: (r: TenantAuditRow) => r.actorName },
            render: (r: TenantAuditRow) => <span className="text-sm">{r.actorName}</span>,
          },
          {
            key: 'reason',
            header: t('common:column.reason'),
            render: (r: TenantAuditRow) => <span className="text-sm max-w-[260px] line-clamp-2 block">{r.reason || '—'}</span>,
          },
          {
            key: 'when',
            header: t('common:column.when'),
            align: 'right',
            sortValue: (r: TenantAuditRow) => r.at,
            render: (r: TenantAuditRow) => <span className="text-xs text-muted">{formatDateTime(new Date(r.at).getTime())}</span>,
          },
        ]}
      />
    </div>
  )
}

export function AdminIsolation() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, isLoading } = useTenantIsolation()
  const { data: overview } = useTenantOverview()

  if (isLoading || !data) {
    return (
      <div data-testid="admin-isolation">
        <PageHeader title={t('people.isolation')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  return (
    <div data-testid="admin-isolation">
      <PageHeader
        title={t('people.isolation')}
        subtitle={t('people.isolationSubtitle')}
        crumbs={[{ label: t('common:crumb.tenantadmin') }, { label: t('people.data') }]}
        helpId="admin-isolation"
      />

      <Card className="mb-5 p-4 flex items-start gap-3 border-brand/40 bg-brand/5" data-testid="admin-isolation-note">
        <ShieldCheck size={18} className="text-brand shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-navy dark:text-dk-texthi">{t('people.stamped')}<span className="font-mono">{data.tenantId}</span>
          </p>
          <p className="text-sm text-muted">
            {t('people.isolationNote')}
          </p>
        </div>
      </Card>

      <DataTable
        testId="admin-isolation-table"
        className="max-w-xl"
        rows={data.collections}
        keyOf={(r: IsolationReport['collections'][number]) => r.name}
        empty={{ title: t('people.nothingYet'), message: '' }}
        pageSize={20}
        columns={[
          { key: 'name', header: t('common:column.recordtype'), sortValue: (r) => r.name, render: (r) => <strong>{t(`status:collection.${r.name}`, { defaultValue: r.name })}</strong> },
          {
            key: 'count',
            header: t('common:column.belongingtoyou'),
            align: 'right',
            sortValue: (r) => r.count,
            render: (r) => <span className="tabular-nums font-semibold">{r.count}</span>,
          },
        ]}
      />

      {overview && (
        <p className="text-xs text-muted mt-4">
          <Trans
            i18nKey="admin:people.tenantLine"
            values={{
              name: overview.tenant.name,
              legal: overview.tenant.legalName,
              cr: overview.tenant.crNumber,
              vat: overview.tenant.vatNumber,
            }}
            components={{ 1: <strong /> }}
          />
        </p>
      )}
    </div>
  )
}
