import { QRCodeSVG } from 'qrcode.react'
import { useMemo } from 'react'

export function Barcode({ value, height = 48, className }: { value: string; height?: number; className?: string }) {
  const bars = useMemo(() => {
    const seed = value.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const widths: number[] = []
    let s = seed
    for (let i = 0; i < 44; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      widths.push(1 + (s % 3))
    }
    return widths
  }, [value])
  return (
    <div className={className} aria-label={`Barcode ${value}`}>
      <svg width="100%" height={height} viewBox={`0 0 ${bars.reduce((a, b) => a + b + 1, 0)} ${height}`} preserveAspectRatio="none" role="img">
        {(() => {
          let x = 0
          return bars.map((w, i) => {
            const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={height} fill="#0f214a" /> : null
            x += w + 1
            return rect
          })
        })()}
      </svg>
      <div className="text-center text-[11px] tracking-[3px] font-mono text-navy dark:text-dk-text mt-1">{value}</div>
    </div>
  )
}

export function QrTag({ value, size = 96 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} level="M" bgColor="transparent" fgColor="#0f214a" />
}
