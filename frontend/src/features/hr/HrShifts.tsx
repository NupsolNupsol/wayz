import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, ScrollText, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Field, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { hrApi } from '@/api/hr.api'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { formatDateTime } from '@/utils'

export function HrShifts() {
  const { t } = useTranslation(['hr', 'common'])
  const qc = useQueryClient()

  const window = useQuery({ queryKey: ['hr', 'shift-window'], queryFn: hrApi.shiftWindow })
  const hours = useQuery({ queryKey: ['hr', 'hours'], queryFn: () => hrApi.hours() })
  const audit = useQuery({ queryKey: ['hr', 'people-audit'], queryFn: () => hrApi.peopleAudit() })

  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const save = useMutation({
    mutationFn: () => hrApi.setShiftWindow({ startsAt: startsAt || window.data!.startsAt, endsAt: endsAt || window.data!.endsAt }),
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ['hr'] })
      setStartsAt('')
      setEndsAt('')
      toast('success', t('shifts.windowSaved'), t('shifts.windowSavedDetail', { from: w.startsAt, to: w.endsAt }))
    },
    onError: (e) => toast('danger', t('shifts.windowFailed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
  })

  const w = window.data

  return (
    <div data-testid="hr-shifts">
      <PageHeader
        title={t('shifts.title')}
        subtitle={t('shifts.subtitle')}
        crumbs={[{ label: t('common:crumb.hr') }, { label: t('shifts.title') }]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t('shifts.window')} value={w ? `${w.startsAt} → ${w.endsAt}` : '—'} icon={<Clock size={18} />} tone="info" testId="hr-shift-window" />
        <StatCard label={t('shifts.length')} value={w ? `${Math.round((w.lengthMin / 60) * 10) / 10} h` : '—'} tone="neutral" testId="hr-shift-length" />
        <StatCard label={t('shifts.peopleCounted')} value={hours.data?.rows.length ?? 0} icon={<Users size={18} />} tone="neutral" testId="hr-hours-people" />
        <StatCard label={t('shifts.hoursWorked')} value={`${hours.data?.totalHours ?? 0} h`} tone="success" testId="hr-hours-total" />
      </div>

      <Card className="mb-5">
        <SectionTitle className="mb-3">{t('shifts.setWindow')}</SectionTitle>
        <p className="text-xs text-muted mb-3">{t('shifts.setWindowHint')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 items-end">
          <Field label={t('shifts.startsAt')}>
            <input type="time" className="lf-input" value={startsAt || w?.startsAt || ''} onChange={(e) => setStartsAt(e.target.value)} data-testid="hr-shift-start" />
          </Field>
          <Field label={t('shifts.endsAt')}>
            <input type="time" className="lf-input" value={endsAt || w?.endsAt || ''} onChange={(e) => setEndsAt(e.target.value)} data-testid="hr-shift-end" />
          </Field>
          <div className="mb-4">
            <Button onClick={() => save.mutate()} loading={save.isPending} data-testid="hr-shift-save">{t('shifts.save')}</Button>
          </div>
        </div>
      </Card>

      <Card className="mb-5">
        <SectionTitle className="mb-3 flex items-center gap-2"><Users size={18} /> {t('shifts.hoursTitle')}</SectionTitle>
        {hours.isLoading ? (
          <Spinner />
        ) : (
          <DataTable
            testId="hr-hours-table"
            rows={hours.data?.rows ?? []}
            keyOf={(r) => r.agentId}
            initialSort={{ key: 'hours', dir: 'desc' }}
            empty={{ title: t('shifts.noHours'), message: t('shifts.noHoursHint') }}
            columns={[
              { key: 'name', header: t('common:column.agent'), sortValue: (r) => r.name, filter: { kind: 'text', value: (r) => r.name }, render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'role', header: t('common:column.role'), filter: { kind: 'text', value: (r) => r.role ?? '' }, render: (r) => <span className="text-muted text-xs">{r.role ?? '—'}</span> },
              { key: 'shifts', header: t('shifts.shiftsWorked'), align: 'right', sortValue: (r) => r.shifts, render: (r) => <span className="tabular-nums">{r.shifts}</span> },
              { key: 'hours', header: t('shifts.hours'), align: 'right', sortValue: (r) => r.hours, render: (r) => <strong className="tabular-nums">{r.hours}</strong> },
              { key: 'expected', header: t('shifts.expected'), align: 'right', sortValue: (r) => r.expectedHours, render: (r) => <span className="tabular-nums text-muted">{r.expectedHours}</span> },
              { key: 'open', header: t('shifts.stillOpen'), align: 'right', render: (r) => (r.stillOpen ? <span className="text-amber-600 font-semibold">{r.stillOpen}</span> : <span className="text-muted">—</span>) },
              { key: 'seen', header: t('shifts.lastSeen'), sortValue: (r) => (r.lastSeen ? new Date(r.lastSeen).getTime() : 0), render: (r) => <span className="text-xs text-muted tabular-nums">{r.lastSeen ? formatDateTime(new Date(r.lastSeen).getTime()) : '—'}</span> },
            ]}
          />
        )}
      </Card>

      <Card>
        <SectionTitle className="mb-3 flex items-center gap-2"><ScrollText size={18} /> {t('shifts.auditTitle')}</SectionTitle>
        <p className="text-xs text-muted mb-3">{t('shifts.auditHint')}</p>
        {audit.isLoading ? (
          <Spinner />
        ) : (
          <DataTable
            testId="hr-audit-table"
            rows={audit.data?.rows ?? []}
            keyOf={(r) => r._id}
            initialSort={{ key: 'at', dir: 'desc' }}
            empty={{ title: t('shifts.noAudit'), message: t('shifts.noAuditHint') }}
            columns={[
              { key: 'at', header: t('common:column.when'), sortValue: (r) => new Date(r.at).getTime(), render: (r) => <span className="text-xs tabular-nums">{formatDateTime(new Date(r.at).getTime())}</span> },
              { key: 'who', header: t('common:column.agent'), filter: { kind: 'text', value: (r) => r.actorName }, render: (r) => r.actorName },
              {
                key: 'action',
                header: t('common:column.action'),
                filter: { kind: 'select', options: (audit.data?.actions ?? []).map((a) => ({ label: a.replaceAll('_', ' ').toLowerCase(), value: a })), value: (r) => r.action },
                render: (r) => <span className="text-xs font-medium">{r.action.replaceAll('_', ' ').toLowerCase()}</span>,
              },
              { key: 'detail', header: t('common:column.details'), render: (r) => <span className="text-xs text-muted">{r.detail ?? r.reason ?? '—'}</span> },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
