import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, MapPin, Plus, Boxes, Power, ChevronRight, Server } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle, Button, Field, Spinner, Badge, EmptyState } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import {
  useCreateKiosk,
  useCreateSite,
  useCreateStation,
  useManagerOrg,
  useUpdateKiosk,
  useUpdateSite,
  useUpdateStation,
} from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { ENGINE_META, engineLabel } from '@/config/engineMeta'
import type { EngineKind } from '@/api/types'
import type { OrgSite, OrgStation } from '@/api/manager.api'

type Dialog =
  | { kind: 'site'; id?: string; initial?: Partial<OrgSite> }
  | { kind: 'station'; id?: string; siteId: string; initial?: Partial<OrgStation> }
  | { kind: 'kiosk'; id?: string; stationId: string; initial?: Record<string, unknown> }
  | null

export function ManagerOrg() {
  const { t } = useTranslation(['manager', 'common'])
  const { data, isLoading } = useManagerOrg()
  const createSite = useCreateSite()
  const updateSite = useUpdateSite()
  const createStation = useCreateStation()
  const updateStation = useUpdateStation()
  const createKiosk = useCreateKiosk()
  const updateKiosk = useUpdateKiosk()

  const [dialog, setDialog] = useState<Dialog>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [engines, setEngines] = useState<EngineKind[]>([])

  const open = (d: Dialog, initial: Record<string, string> = {}, eng: EngineKind[] = []) => {
    setForm(initial)
    setEngines(eng)
    setDialog(d)
  }

  const fail = (e: unknown) => toast('danger', t('common:error.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
  const done = (msg: string) => { toast('success', msg); setDialog(null) }

  const submit = () => {
    if (!dialog) return
    if (dialog.kind === 'site') {
      const payload = { name: form.name, city: form.city, venueType: form.venueType, address: form.address, contactPhone: form.contactPhone }
      if (dialog.id) updateSite.mutate({ id: dialog.id, patch: payload }, { onSuccess: () => done('Site updated'), onError: fail })
      else createSite.mutate(payload, { onSuccess: () => done('Site created'), onError: fail })
    }
    if (dialog.kind === 'station') {
      const payload = {
        siteId: dialog.siteId,
        name: form.name,
        code: form.code,
        engineKinds: engines,
        openingTime: form.openingTime,
        closingTime: form.closingTime,
        contactPhone: form.contactPhone,
      }
      if (dialog.id) updateStation.mutate({ id: dialog.id, patch: payload }, { onSuccess: () => done('Station updated'), onError: fail })
      else createStation.mutate(payload, { onSuccess: () => done('Station created'), onError: fail })
    }
    if (dialog.kind === 'kiosk') {
      const payload = { stationId: dialog.stationId, name: form.name, code: form.code, location: form.location }
      if (dialog.id) updateKiosk.mutate({ id: dialog.id, patch: payload }, { onSuccess: () => done('Kiosk updated'), onError: fail })
      else createKiosk.mutate(payload, { onSuccess: () => done('Kiosk created'), onError: fail })
    }
  }

  const toggle = (kind: 'site' | 'station' | 'kiosk', id: string, active: boolean) => {
    const patch = { active: !active }
    const opts = {
      onSuccess: () => toast(active ? 'warning' : 'success', active ? 'Deactivated' : 'Reactivated'),
      onError: fail,
    }
    if (kind === 'site') updateSite.mutate({ id, patch }, opts)
    if (kind === 'station') updateStation.mutate({ id, patch }, opts)
    if (kind === 'kiosk') updateKiosk.mutate({ id, patch }, opts)
  }

  if (isLoading || !data) {
    return (
      <div data-testid="manager-org">
        <PageHeader title={t('org.title')} subtitle={t('org.loading')} />
        <Spinner />
      </div>
    )
  }

  const saving = createSite.isPending || createStation.isPending || createKiosk.isPending ||
    updateSite.isPending || updateStation.isPending || updateKiosk.isPending

  return (
    <div data-testid="manager-org">
      <PageHeader
        title={t('org.title')}
        subtitle={t('org.subtitle')}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.organisation') }]}
        actions={
          <Button onClick={() => open({ kind: 'site' }, { venueType: 'MALL' })} data-testid="org-add-site">
            <Plus size={16} />{t('org.addSite')}</Button>
        }
      />

      <div className="lf-card p-3 mb-5 text-xs text-muted flex flex-wrap items-center gap-2">
        <Building2 size={14} /> {t('org.site')}
        <ChevronRight size={12} />
        <MapPin size={14} /> {t('org.station')}
        <ChevronRight size={12} />
        <Server size={14} /> Kiosk
        <ChevronRight size={12} />
        <Boxes size={14} />{t('org.compartments')}<span className="ms-auto">{t('org.deactivateNote')}</span>
      </div>

      {data.sites.length === 0 ? (
        <Card><EmptyState icon={<Building2 size={24} />} title={t('org.noSites')} message={t('org.noSitesMessage')} /></Card>
      ) : (
        <div className="flex flex-col gap-4" data-testid="org-tree">
          {data.sites.map((site) => (
            <Card key={site._id} className={clsx(!site.active && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <SectionTitle>{site.name}</SectionTitle>
                    <p className="text-xs text-muted mt-0.5">
                      {t('org.siteLine', { city: site.city, venue: site.venueType ?? 'VENUE', count: site.stations.length })}
                      {site.address ? ` · ${site.address}` : ''}
                    </p>
                  </div>
                  {!site.active && <Badge tone="danger">{t('org.inactive')}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => open({ kind: 'site', id: site._id }, {
                    name: site.name, city: site.city, venueType: site.venueType ?? 'MALL',
                    address: site.address ?? '', contactPhone: site.contactPhone ?? '',
                  })}>{t('common:action.edit')}</Button>
                  <Button variant="ghost" onClick={() => toggle('site', site._id, site.active)} title={site.active ? t('org.deactivate') : t('org.reactivate')}>
                    <Power size={15} />
                  </Button>
                  <Button variant="secondary" onClick={() => open({ kind: 'station', siteId: site._id }, { openingTime: '08:00', closingTime: '22:00' })} data-testid={`org-add-station-${site._id}`}>
                    <Plus size={15} /> {t('org.station')}
                  </Button>
                </div>
              </div>

              {site.stations.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 ps-2 sm:ps-6 border-s-2 border-line">
                  {site.stations.map((station) => (
                    <div key={station._id} className={clsx('lf-card p-3', !station.active && 'opacity-60')}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <MapPin size={17} className="text-brand shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold text-navy dark:text-dk-texthi">
                              {station.name} {station.code && <span className="text-xs text-muted">({station.code})</span>}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {t('org.stationLine', { open: station.openingTime, close: station.closingTime, units: station.total, live: station.activeSessions })}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {station.engineKinds.map((e) => (
                                <Badge key={e} tone="neutral">{engineLabel(e as EngineKind)}</Badge>
                              ))}
                            </div>
                          </div>
                          {!station.active && <Badge tone="danger">{t('org.inactive')}</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" onClick={() => open({ kind: 'station', id: station._id, siteId: site._id }, {
                            name: station.name, code: station.code ?? '',
                            openingTime: station.openingTime ?? '08:00', closingTime: station.closingTime ?? '22:00',
                            contactPhone: station.contactPhone ?? '',
                          }, station.engineKinds)}>{t('common:action.edit')}</Button>
                          <Button variant="ghost" onClick={() => toggle('station', station._id, station.active)} title={station.active ? t('org.deactivate') : t('org.reactivate')}>
                            <Power size={14} />
                          </Button>
                          <Button variant="ghost" onClick={() => open({ kind: 'kiosk', stationId: station._id })} data-testid={`org-add-kiosk-${station._id}`}>
                            <Plus size={14} /> Kiosk
                          </Button>
                        </div>
                      </div>

                      {station.kiosks.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                          {station.kiosks.map((k) => (
                            <div key={k._id} className={clsx('rounded-lg bg-canvas dark:bg-dk-elevated p-2.5', !k.active && 'opacity-60')}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-navy dark:text-dk-text flex items-center gap-1.5">
                                    <Server size={13} /> {k.name}
                                  </p>
                                  {k.location && <p className="text-[11px] text-muted mt-0.5 line-clamp-1">{k.location}</p>}
                                </div>
                                <button
                                  onClick={() => toggle('kiosk', k._id, k.active)}
                                  className="text-muted hover:text-danger-strong shrink-0"
                                  title={k.active ? 'Deactivate' : 'Reactivate'}
                                >
                                  <Power size={13} />
                                </button>
                              </div>
                              <p className="text-xs text-muted mt-1.5">
                                <strong className="text-navy dark:text-dk-text">{k.total}</strong> {t('org.kioskLine', { inUse: k.inUse, free: k.available })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog ? `${dialog.id ? 'Edit' : 'Add'} ${dialog.kind}` : ''}
        testId="org-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>{t('common:action.cancel')}</Button>
            <Button onClick={submit} loading={saving} disabled={!form.name?.trim()} data-testid="org-submit">
              {dialog?.id ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <Field label={t('common:field.name')} required>
          <input className="lf-input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="org-name" />
        </Field>

        {dialog?.kind === 'site' && (
          <>
            <Field label={t('org.city')} required>
              <input className="lf-input" value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="org-city" />
            </Field>
            <Field label={t('org.venueType')}>
              <Select
                value={form.venueType ?? 'MALL'}
                onChange={(v) => setForm({ ...form, venueType: v })}
                options={data.venueTypes.map((v) => ({ label: v.replaceAll('_', ' '), value: v }))}
                testId="org-venue-type"
              />
            </Field>
            <Field label={t('org.address')}><input className="lf-input" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </>
        )}

        {dialog?.kind === 'station' && (
          <>
            <Field label={t('org.code')} hint={t('org.codeHint')}>
              <input className="lf-input" value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label={t('org.servicesOffered')} hint={t('org.servicesHint')}>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ENGINE_META) as EngineKind[]).map((e) => {
                  const on = engines.includes(e)
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEngines(on ? engines.filter((x) => x !== e) : [...engines, e])}
                      className={clsx('lf-chip !px-3 !py-1.5 border transition-colors', on ? 'border-brand bg-brand/10 text-brand font-semibold' : 'border-line text-muted')}
                    >
                      {engineLabel(e)}
                    </button>
                  )
                })}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label={t('org.opens')}><input type="time" className="lf-input" value={form.openingTime ?? '08:00'} onChange={(e) => setForm({ ...form, openingTime: e.target.value })} /></Field>
              <Field label={t('org.closes')}><input type="time" className="lf-input" value={form.closingTime ?? '22:00'} onChange={(e) => setForm({ ...form, closingTime: e.target.value })} /></Field>
            </div>
          </>
        )}

        {dialog?.kind === 'kiosk' && (
          <>
            <Field label={t('org.code')}><input className="lf-input" value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label={t('org.location')} hint={t('org.locationHint')}>
              <input className="lf-input" value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t('org.locationPlaceholder')} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}
