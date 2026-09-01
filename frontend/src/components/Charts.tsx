import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

export function BarChart({ data, unit = '', height = 150 }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="flex items-end gap-3 min-w-full" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex-1 min-w-[26px] flex flex-col items-center justify-end h-full" title={`${d.label}: ${d.value}${unit}`}>
            <span className="text-xs font-bold text-navy dark:text-dk-text mb-1 tabular-nums">{d.value > 0 ? d.value : ''}</span>
            <div
              className={clsx('w-full max-w-[46px] rounded-t-lg transition-all', d.value > 0 ? 'bg-brand' : 'bg-line')}
              style={{ height: `${Math.max(2, (d.value / max) * (height - 28))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2 border-t border-line pt-2 min-w-full">
        {data.map((d) => (
          <span key={d.label} className="flex-1 min-w-[26px] text-center text-[11px] font-medium text-muted truncate">{d.label}</span>
        ))}
      </div>
    </div>
  )
}

const R = 42
const CIRCUMFERENCE = 2 * Math.PI * R
const SEGMENT_GAP = 3

export function DonutChart({ data, size = 132 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const { t } = useTranslation('common')
  const total = data.reduce((s, d) => s + d.value, 0)
  const divisor = Math.max(1, total)

  const slices = data.filter((d) => d.value > 0)
  const single = slices.length === 1

  let offset = 0
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }} role="img" aria-label="Donut chart" className="shrink-0">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(var(--line))" strokeWidth="13" />
        {slices.map((d) => {
          const share = (d.value / divisor) * CIRCUMFERENCE
          const drawn = single ? CIRCUMFERENCE : Math.max(0.75, share - SEGMENT_GAP)
          const seg = (
            <circle
              key={d.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={d.color}
              strokeWidth="13"
              strokeLinecap="butt"
              strokeDasharray={`${drawn} ${CIRCUMFERENCE - drawn}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          )
          offset += share
          return seg
        })}
        <text x="50" y="47" textAnchor="middle" fontSize="17" fontWeight="800" fill="rgb(var(--ink))">{total}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="6.5" fill="rgb(var(--muted))">{t('table.total')}</text>
      </svg>
      <ul className="text-sm flex flex-col gap-2 flex-1 min-w-0">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-muted truncate">{d.label}</span>
            <span className="ms-auto font-semibold text-navy dark:text-dk-text tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
