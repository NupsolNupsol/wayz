import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

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

  /** A comma is what many keyboards give for a decimal point; treat it as one rather than as NaN. */
  const asNumber = (text: string) => Number(text.replace(',', '.'))

  const settle = (text: string): number => {
    const parsed = asNumber(text)
    const floor = fallback ?? min ?? 0
    if (text.trim() === '' || Number.isNaN(parsed)) return floor
    if (min !== undefined && parsed < min) return min
    if (max !== undefined && parsed > max) return max
    return parsed
  }

  return (
    <input
      /*
       * Deliberately not type="number": a number input silently discards a comma, and a POS keyboard
       * in Arabic or French gives a comma for the decimal point. Text plus a decimal keypad accepts
       * both, and the value is parsed and clamped below either way.
       */
      type="text"
      inputMode="decimal"
      autoComplete="off"
      data-min={min}
      data-max={max}
      data-step={step}
      disabled={disabled}
      className={clsx('lf-input tabular-nums', className)}
      value={raw}
      aria-label={ariaLabel}
      data-testid={testId}
      onChange={(e) => {
        // Digits, one separator and a leading minus: anything else typed at a counter is a slip.
        const text = e.target.value.replace(/[^0-9.,-]/g, '')
        if (text.trim() === '') {
          setRaw(text)
          return
        }
        const parsed = asNumber(text)
        if (Number.isNaN(parsed)) {
          setRaw(text)
          return
        }
        // A typed number never escapes its bounds — waiting for blur lets an impossible
        // figure reach the till, and a price is quoted off it in the meantime.
        const bounded = settle(text)
        setRaw(bounded === parsed ? text : String(bounded))
        emitted.current = bounded
        onChange(bounded)
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
