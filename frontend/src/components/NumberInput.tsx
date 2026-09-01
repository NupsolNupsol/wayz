import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

/**
 * A number field you can actually empty.
 *
 * `value={n} onChange={parseInt(e.target.value) || 1}` snaps the field back to 1 the
 * moment you clear it, so the only way to change 1 to 25 is the spinner. This keeps the
 * raw text while you type and only coerces on blur.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  fallback,
  className,
  testId,
  ariaLabel,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  fallback?: number
  className?: string
  testId?: string
  ariaLabel?: string
  disabled?: boolean
}) {
  const [raw, setRaw] = useState(String(value))
  const emitted = useRef(value)

  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value
      setRaw(String(value))
    }
  }, [value])

  const settle = (text: string): number => {
    const parsed = Number(text)
    const floor = fallback ?? min ?? 0
    if (text.trim() === '' || Number.isNaN(parsed)) return floor
    if (min !== undefined && parsed < min) return min
    if (max !== undefined && parsed > max) return max
    return parsed
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={clsx('lf-input tabular-nums', className)}
      value={raw}
      aria-label={ariaLabel}
      data-testid={testId}
      onChange={(e) => {
        const text = e.target.value
        setRaw(text)
        if (text.trim() === '') return
        const parsed = Number(text)
        if (Number.isNaN(parsed)) return
        emitted.current = parsed
        onChange(parsed)
      }}
      onBlur={() => {
        const settled = settle(raw)
        setRaw(String(settled))
        if (settled !== emitted.current) {
          emitted.current = settled
          onChange(settled)
        }
      }}
    />
  )
}
