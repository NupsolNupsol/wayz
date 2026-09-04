import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPinned, RotateCcw, Save, Undo2 } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, SectionTitle, Spinner } from '@/components/ui'
import { StationMap, type MapPoint } from '@/components/StationMap'
import { MarkerIcon, toneFor } from '@/components/mapMarkers'
import { useSaveStationMap, useStationMap } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'

type Placement = { x: number | null; y: number | null }

export function AdminStationMap() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, isLoading } = useStationMap()
  const save = useSaveStationMap()

  const [moved, setMoved] = useState<Record<string, Placement>>({})
  const [siteId, setSiteId] = useState<string>('')
  const [selected, setSelected] = useState<string | null>(null)
  const [toPlace, setToPlace] = useState<string | null>(null)

  const sites = useMemo(() => data?.sites ?? [], [data])
  useEffect(() => {
    if (!siteId && sites.length) setSiteId(sites[0]._id)
  }, [siteId, sites])

  const points = useMemo<MapPoint[]>(() => {
    return (data?.points ?? [])
      .filter((p) => p.siteId === siteId)
      .map((p) => {
        const patch = moved[p._id]
        return patch ? { ...p, mapX: patch.x, mapY: patch.y } : p
      })
  }, [data, moved, siteId])

  const placed = points.filter((p) => p.mapX !== null && p.mapY !== null)
  const tray = points.filter((p) => p.mapX === null || p.mapY === null)
  const dirty = Object.keys(moved).length > 0

  const place = (id: string, x: number | null, y: number | null) =>
    setMoved((prev) => ({ ...prev, [id]: { x, y } }))

  const commit = () => {
    const placements = Object.entries(moved).map(([id, at]) => ({ id, x: at.x, y: at.y }))
    if (!placements.length) return
    save.mutate(placements, {
      onSuccess: () => {
        setMoved({})
        toast('success', t('map.saved'), t('map.savedDetail', { count: placements.length }))
      },
      onError: (e) => toast('danger', t('map.notSaved'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
    })
  }

  if (isLoading) {
    return (
      <div data-testid="admin-station-map">
        <PageHeader title={t('map.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  return (
    <div data-testid="admin-station-map">
      <PageHeader
        title={t('map.title')}
        subtitle={t('map.subtitle')}
        crumbs={[{ label: t('common:crumb.home'), to: '/admin' }, { label: t('map.title') }]}
        actions={
          <>
            {dirty && (
              <Button variant="ghost" onClick={() => setMoved({})} data-testid="map-discard">
                <Undo2 size={16} /> {t('map.discard')}
              </Button>
            )}
            <Button onClick={commit} loading={save.isPending} disabled={!dirty} data-testid="map-save">
              <Save size={16} /> {t('map.save')}
            </Button>
          </>
        }
      />

      {sites.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="map-sites">
          {sites.map((site) => (
            <button
              key={site._id}
              type="button"
              onClick={() => setSiteId(site._id)}
              data-testid={`map-site-${site._id}`}
              className={clsx(
                'lf-btn !h-9 !px-3 text-xs',
                siteId === site._id ? 'bg-brand text-brand-fg' : 'bg-surface border border-line text-muted hover:text-brand',
              )}
            >
              {site.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <SectionTitle className="flex items-center gap-2">
              <MapPinned size={18} className="text-brand" /> {t('map.canvas')}
            </SectionTitle>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-navy inline-block" /> {t('map.legendStation')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-sky-500 inline-block" /> {t('map.legendLagoon')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-brand inline-block" /> {t('map.legendDesk')}
              </span>
            </div>
          </div>

          <StationMap
            points={points}
            selectedId={selected}
            onMove={(id, x, y) => place(id, x, y)}
            onPick={(p) => setSelected(p._id)}
            onDropNew={(id, x, y) => place(id, x, y)}
            onTapCanvas={(x, y) => {
              if (!toPlace) return
              place(toPlace, x, y)
              setToPlace(null)
            }}
            testId="admin-map-canvas"
          >
            {toPlace && (
              <p
                className="absolute top-3 start-1/2 -translate-x-1/2 rounded-full bg-brand text-brand-fg text-xs font-semibold px-3 py-1.5 shadow-card pointer-events-none"
                data-testid="map-tap-hint"
              >
                {t('map.tapToDrop', { name: points.find((p) => p._id === toPlace)?.name ?? '' })}
              </p>
            )}
            {placed.length === 0 && (
              <p
                className="absolute inset-0 flex items-center justify-center text-sm text-muted pointer-events-none px-8 text-center"
                data-testid="map-empty"
              >
                {t('map.empty')}
              </p>
            )}
          </StationMap>

          <p className="text-xs text-muted mt-3">{t('map.hint')}</p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <SectionTitle className="mb-1">{t('map.tray')}</SectionTitle>
            <p className="text-xs text-muted mb-3">{t('map.trayHint')}</p>
            {tray.length === 0 ? (
              <p className="text-sm text-muted" data-testid="map-tray-empty">{t('map.allPlaced')}</p>
            ) : (
              <div className="flex flex-col gap-2" data-testid="map-tray">
                {tray.map((point) => (
                  <button
                    key={point._id}
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', point._id)}
                    onClick={() => setToPlace((prev) => (prev === point._id ? null : point._id))}
                    className={clsx(
                      'lf-card p-2.5 flex items-center gap-2.5 text-start cursor-grab active:cursor-grabbing hover:border-brand w-full',
                      toPlace === point._id && 'border-brand ring-1 ring-brand/30 bg-brand/5',
                    )}
                    data-testid={`map-tray-${point._id}`}
                  >
                    <span className={clsx('w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0', toneFor(point))}>
                      <MarkerIcon point={point} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-navy dark:text-dk-texthi truncate">{point.name}</span>
                      <span className="block text-[11px] text-muted truncate">
                        {point.kind === 'STATION' ? t('map.station') : (point.stationName ?? '')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <SectionTitle className="mb-3">{t('map.placed', { count: placed.length })}</SectionTitle>
            {placed.length === 0 ? (
              <p className="text-sm text-muted">{t('map.noneYet')}</p>
            ) : (
              <div className="flex flex-col gap-1.5" data-testid="map-placed">
                {placed.map((point) => (
                  <div
                    key={point._id}
                    className={clsx(
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                      selected === point._id ? 'bg-brand/10' : 'hover:bg-canvas dark:hover:bg-dk-elevated',
                    )}
                  >
                    <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', toneFor(point))} />
                    <button
                      type="button"
                      className="flex-1 text-start truncate"
                      onClick={() => setSelected(point._id)}
                      data-testid={`map-focus-${point._id}`}
                    >
                      {point.name}
                    </button>
                    <span className="text-[11px] text-muted tabular-nums">
                      {Math.round((point.mapX as number) * 100)},{Math.round((point.mapY as number) * 100)}
                    </span>
                    <button
                      type="button"
                      className="text-muted hover:text-danger-strong"
                      title={t('map.takeOff')}
                      onClick={() => place(point._id, null, null)}
                      data-testid={`map-remove-${point._id}`}
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {dirty && (
              <Badge tone="warning" className="mt-3" testId="map-unsaved">
                {t('map.unsaved', { count: Object.keys(moved).length })}
              </Badge>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
