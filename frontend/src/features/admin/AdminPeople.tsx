import { ScrollText, ShieldCheck } from 'lucide-react'
import { formatDateTime } from '@/utils'
import { Trans, useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { RefText } from '@/components/RefLink'
import { Badge, Card, Spinner } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { useTenantAudit, useTenantIsolation, useTenantOverview } from '@/hooks'
import type { IsolationReport, TenantAuditRow } from '@/api/admin.api'

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
