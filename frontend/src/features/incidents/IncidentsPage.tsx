import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, StatusBadge, Field, Spinner } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { Modal } from '@/components/Modal'
import { useIncidents, useCreateIncident, useIncidentCatalogue, useUpdateIncident } from '@/hooks'
import { ENGINE_META, engineLabel } from '@/config/engineMeta'
import { formatDateTime } from '@/utils'
import { toast } from '@/state/toastStore'
import type { EngineKind, IncidentType } from '@/api/types'
import { RefText } from '@/components/RefLink'

const NEXT: Record<string, string | null> = { REPORTED: 'INVESTIGATING', INVESTIGATING: 'AWAITING_APPROVAL', AWAITING_APPROVAL: 'RESOLVED', RESOLVED: null, REJECTED: null }

export function IncidentsPage() {
  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const { data: rows = [], isLoading } = useIncidents()
  const { data: catalogue } = useIncidentCatalogue()
  const createMut = useCreateIncident()
  const updateMut = useUpdateIncident()
  const [open, setOpen] = useState(false)
  const [engineKind, setEngineKind] = useState<EngineKind>('SHOP_AND_DROP')
  const [type, setType] = useState<IncidentType>('MISSING_BAG')
  const [desc, setDesc] = useState('')

  const engineTypes = catalogue?.byEngine?.[engineKind] ?? []
  const labelOf = (t: IncidentType) => catalogue?.labels?.[t] ?? t.replaceAll('_', ' ')
  const allTypes = catalogue?.all ?? []

  const chooseEngine = (next: EngineKind) => {
    setEngineKind(next)
    const valid = catalogue?.byEngine?.[next] ?? []
    if (valid.length && !valid.includes(type)) setType(valid[0])
  }

  const openModal = () => {
    const valid = catalogue?.byEngine?.[engineKind] ?? []
    if (valid.length) setType(valid[0])
    setOpen(true)
  }

  const submit = () => {
    createMut.mutate(
      { type, description: desc, engineKind },
      { onSuccess: () => { toast('warning', t('incidents.logged')); setOpen(false); setDesc('') } },
    )
  }
  const advance = (id: string, status: string) => {
    const next = NEXT[status]
    if (next) updateMut.mutate({ id, status: next }, { onSuccess: () => toast('info', t('incidents.updated'), next) })
  }

  return (
    <div data-testid="incidents-page">
      <PageHeader title={t('incidents.title')} subtitle={t('incidents.subtitle')} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.incidents') }]}
        helpId="incidents"
        actions={<Button variant="danger" onClick={openModal} data-testid="incident-new"><TriangleAlert size={16} />{t('incidents.log')}</Button>} />

      {isLoading ? <Spinner /> : (
        <DataTable
          testId="incidents-table"
          rows={rows}
          keyOf={(i) => i._id}
          empty={{ title: t('manager:operations.noIncidents'), message: t('manager:operations.noIncidentsHint') }}
          columns={[
            { key: 'ref', header: t('common:column.reference'), sortValue: (i) => i.ref, filter: { kind: 'text', value: (i) => i.ref }, render: (i) => <RefText>{i.ref}</RefText> },
            { key: 'type', header: t('common:column.type'), filter: { kind: 'select', options: allTypes.map((t) => ({ label: labelOf(t), value: t })), value: (i) => i.type }, render: (i) => labelOf(i.type) },
            { key: 'engine', header: t('common:column.service'), filter: { kind: 'select', options: Object.keys(ENGINE_META).map((e) => ({ label: engineLabel(e as EngineKind), value: e })), value: (i) => i.engineKind ?? '' }, render: (i) => <span className="text-muted">{i.engineKind ? engineLabel(i.engineKind) : '—'}</span> },
            { key: 'desc', header: t('common:column.description'), filter: { kind: 'text', value: (i) => i.description }, render: (i) => <span className="text-muted line-clamp-1">{i.description}</span> },
            { key: 'booking', header: t('common:column.booking'), render: (i) => i.bookingId ? <button className="text-brand text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${i.bookingId}`) }}>view</button> : '—' },
            { key: 'status', header: t('common:column.status'), sortValue: (i) => i.status, filter: { kind: 'select', options: ['REPORTED', 'INVESTIGATING', 'AWAITING_APPROVAL', 'RESOLVED', 'REJECTED'].map((s) => ({ label: s.replaceAll('_', ' '), value: s })), value: (i) => i.status }, render: (i) => <StatusBadge status={i.status} /> },
            { key: 'date', header: t('common:column.reported'), align: 'right', sortValue: (i) => new Date(i.createdAt).getTime(), render: (i) => <span className="text-muted">{formatDateTime(new Date(i.createdAt).getTime())}</span> },
            { key: 'action', header: '', align: 'right', render: (i) => NEXT[i.status] ? <Button variant="ghost" onClick={(e) => { e.stopPropagation(); advance(i._id, i.status) }}>→ {NEXT[i.status]?.replaceAll('_', ' ')}</Button> : null },
          ]}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('incidents.log')} testId="incident-log-modal"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common:action.cancel')}</Button><Button variant="danger" onClick={submit} loading={createMut.isPending} disabled={!desc.trim()} data-testid="incident-log-submit">Log</Button></>}>
        <Field label={t('incidents.service')} hint={t('incidents.typeHint')}>
          <Select
            value={engineKind}
            onChange={(v) => chooseEngine(v as EngineKind)}
            options={Object.keys(ENGINE_META).map((e) => ({ label: engineLabel(e as EngineKind), value: e }))}
            testId="incident-engine-select"
          />
        </Field>
        <Field label={t('common:field.type')}>
          <Select value={type} onChange={(v) => setType(v as IncidentType)} options={engineTypes.map((t) => ({ label: labelOf(t), value: t }))} testId="incident-type-select" />
        </Field>
        <Field label={t('common:field.description')} required><textarea className="lf-input h-24 py-2" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      </Modal>
    </div>
  )
}
