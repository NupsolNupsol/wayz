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

  const signed = min === undefined || min < 0

  /**
   * Keep the box to the shape of a number as it is typed.
   *
   * Filtering to "digits and separators" is not enough: 4-8-8-31 survives that filter, parses to
   * nothing, and so sits on screen while the sale quietly keeps whatever the field last emitted —
   * the agent reads one figure and the customer is charged another. A minus is allowed only at the
   * front and only where negatives are meaningful, and only the first separator is kept.
   */
  const shape = (text: string) => {
    const negative = signed && text.trimStart().startsWith('-')
    const body = text.replace(/[^0-9.,]/g, '')
    const at = body.search(/[.,]/)
    const once = at === -1 ? body : body.slice(0, at + 1) + body.slice(at + 1).replace(/[.,]/g, '')
    return (negative ? '-' : '') + once
  }

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
        const text = shape(e.target.value)
        const parsed = asNumber(text)
        // "", "-" and "12." are a number half typed; they are shown but nothing is emitted yet.
        if (text.trim() === '' || Number.isNaN(parsed)) {
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
