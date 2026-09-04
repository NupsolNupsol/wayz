import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Ship } from 'lucide-react'
import { MarkerIcon, toneFor } from './mapMarkers'

export interface MapPoint {
  _id: string
  kind: 'STATION' | 'KIOSK'
  name: string
  siteId: string
  siteName: string
  stationId?: string | null
  stationName?: string | null
  engineKinds: string[]
  active: boolean
  kioskCount?: number
  mapX: number | null
  mapY: number | null
}

export interface BoatPosition {
  x: number
  y: number
  label: string
}

function pointerRatio(host: HTMLElement, clientX: number, clientY: number) {
  const box = host.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (clientX - box.left) / box.width)),
    y: Math.min(1, Math.max(0, (clientY - box.top) / box.height)),
  }
}

export function StationMap({
  points,
  route = [],
  boat = null,
  selectedId = null,
  reachedIds = [],
  onMove,
  onPick,
  onDropNew,
  onTapCanvas,
  testId = 'station-map',
  children,
}: {
  points: MapPoint[]
  route?: string[]
  boat?: BoatPosition | null
  selectedId?: string | null
  reachedIds?: string[]
  onMove?: (id: string, x: number, y: number) => void
  onPick?: (point: MapPoint) => void
  onDropNew?: (id: string, x: number, y: number) => void
  onTapCanvas?: (x: number, y: number) => void
  testId?: string
  children?: React.ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    if (!dragging || !onMove) return
    const move = (e: PointerEvent) => {
      if (!host.current) return
      const at = pointerRatio(host.current, e.clientX, e.clientY)
      onMove(dragging, at.x, at.y)
    }
    const stop = () => setDragging(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragging, onMove])

  const placed = points.filter((p) => p.mapX !== null && p.mapY !== null)
  const at = new Map(placed.map((p) => [p._id, { x: p.mapX as number, y: p.mapY as number }]))
  const legs = route.map((id) => at.get(id)).filter(Boolean) as { x: number; y: number }[]

  return (
    <div
      ref={host}
      data-testid={testId}
      onDragOver={(e) => {
        if (onDropNew) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!onDropNew || !host.current) return
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        if (!id) return
        const spot = pointerRatio(host.current, e.clientX, e.clientY)
        onDropNew(id, spot.x, spot.y)
      }}
      onClick={(e) => {
        if (!onTapCanvas || !host.current) return
        if ((e.target as HTMLElement).closest('button')) return
        const spot = pointerRatio(host.current, e.clientX, e.clientY)
        onTapCanvas(spot.x, spot.y)
      }}
      className="relative w-full overflow-hidden rounded-[26px] border border-line dark:border-dk-border select-none touch-none"
      style={{
        aspectRatio: '16 / 9',
        minHeight: 260,
        background:
          'radial-gradient(circle at 22% 18%, rgb(var(--brand) / 0.16) 0%, transparent 45%), radial-gradient(circle at 78% 72%, rgb(var(--secondary) / 0.18) 0%, transparent 50%), linear-gradient(160deg, rgb(var(--canvas)) 0%, rgb(var(--surface)) 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--line) / 0.9) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / 0.9) 1px, transparent 1px)',
          backgroundSize: '6.25% 11.11%',
        }}
      />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {legs.length > 1 && (
          <polyline
            points={legs.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="none"
            stroke="rgb(var(--brand))"
            strokeWidth="0.6"
            strokeDasharray="1.6 1.2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity="0.95"
          />
        )}
      </svg>

      {placed.map((point) => {
        const order = route.indexOf(point._id)
        const reached = reachedIds.includes(point._id)
        return (
          <button
            key={point._id}
            type="button"
            data-testid={`map-point-${point._id}`}
            onPointerDown={(e) => {
              if (!onMove) return
              e.preventDefault()
              setDragging(point._id)
            }}
            onClick={() => onPick?.(point)}
            className={clsx(
              'absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group',
              onMove ? 'cursor-grab active:cursor-grabbing' : onPick ? 'cursor-pointer' : 'cursor-default',
            )}
            style={{ left: `${(point.mapX as number) * 100}%`, top: `${(point.mapY as number) * 100}%` }}
          >
            <span
              className={clsx(
                'flex items-center justify-center rounded-full text-white shadow-card ring-2 transition-transform',
                toneFor(point),
                point.kind === 'STATION' ? 'w-10 h-10' : 'w-8 h-8',
                selectedId === point._id ? 'ring-brand scale-110' : 'ring-white/70 dark:ring-dk-bg/60',
                reached && 'opacity-60',
                !point.active && 'grayscale',
              )}
            >
              <MarkerIcon point={point} />
            </span>
            {order >= 0 && (
              <span
                className="absolute -top-2 -end-2 w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-dk-bg"
                data-testid={`map-order-${point._id}`}
              >
                {order + 1}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-md bg-surface/85 dark:bg-dk-elevated/85 text-[11px] font-semibold text-navy dark:text-dk-texthi whitespace-nowrap shadow-sm">
              {point.name}
            </span>
          </button>
        )
      })}

      {boat && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${boat.x * 100}%`,
            top: `${boat.y * 100}%`,
            transform: 'translate(-50%, -180%)',
            transition: 'left 1.6s ease-in-out, top 1.6s ease-in-out',
          }}
          data-testid="map-boat"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-navy text-white ps-1.5 pe-2.5 py-1.5 shadow-pop">
            <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
              <Ship size={14} />
            </span>
            <span className="text-[11px] font-bold whitespace-nowrap">{boat.label}</span>
          </span>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none rounded-[26px]" style={{ boxShadow: 'inset 0 0 60px rgb(var(--shadow) / 0.12)' }} />

      <div className="absolute bottom-3 end-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/80 pointer-events-none">
        <span className="w-6 h-6 rounded-full border border-line dark:border-dk-border flex items-center justify-center">N</span>
      </div>

      {children}
    </div>
  )
}
