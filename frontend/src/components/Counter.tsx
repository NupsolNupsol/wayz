import { Minus, Plus } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * A count, chosen with two buttons.
 *
 * Heads, hours and tours are counted, not typed. A free text field at a counter accepts anything
 * the keyboard emits, and a value the agent cannot read back as a number is one the sale then
 * quietly ignores — so the figure on screen and the figure being charged drift apart. Here the only
 * reachable values are whole steps between the bounds, which is also what a thumb wants on a Sunmi.
 *
 * The bounds are the real ones: seats *left* on the boat, not seats on the boat. Offering a party
 * of four a hull with one seat free only moves the refusal from this screen to the server, with the
 * customer already standing there.
 */
export function Counter({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled,
  suffix,
  className,
  testId,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** A word after the figure — "hours", "people" — so the number is never bare. */
  suffix?: string
  className?: string
  testId?: string
  ariaLabel?: string
}) {
  const clamp = (next: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next))
  const atFloor = disabled || value <= min
  const atCeiling = disabled || (max !== undefined && value >= max)

  const nudge = (by: number) => {
    const next = clamp(value + by)
    if (next !== value) onChange(next)
  }

  return (
    <div
      className={clsx('lf-input flex items-center justify-between gap-1 !px-1', disabled && 'opacity-60', className)}
      data-testid={testId ? `${testId}-row` : undefined}
    >
      <button
        type="button"
        onClick={() => nudge(-step)}
        disabled={atFloor}
        aria-label={ariaLabel ? `${ariaLabel}: one fewer` : 'One fewer'}
        data-testid={testId ? `${testId}-minus` : undefined}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors enabled:hover:bg-brand/10 enabled:hover:text-brand-ink disabled:opacity-30"
      >
        <Minus size={15} />
      </button>

      {/*
        Read-only rather than absent: it keeps the control a form field for a screen reader, and
        lets a test read the figure back the same way it reads any other input.
      */}
      <input
        type="text"
        readOnly
        inputMode="none"
        tabIndex={-1}
        disabled={disabled}
        value={suffix ? `${value} ${suffix}` : String(value)}
        aria-label={ariaLabel}
        aria-live="polite"
        data-testid={testId}
        className="min-w-0 flex-1 cursor-default border-0 bg-transparent p-0 text-center text-sm font-semibold tabular-nums text-navy outline-none dark:text-dk-texthi"
      />

      <button
        type="button"
        onClick={() => nudge(step)}
        disabled={atCeiling}
        aria-label={ariaLabel ? `${ariaLabel}: one more` : 'One more'}
        data-testid={testId ? `${testId}-plus` : undefined}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors enabled:hover:bg-brand/10 enabled:hover:text-brand-ink disabled:opacity-30"
      >
        <Plus size={15} />
      </button>
    </div>
  )
}
