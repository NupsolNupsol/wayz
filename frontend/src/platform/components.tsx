import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * The pieces the control plane is built from.
 *
 * Deliberately the *same* pieces a tenant workspace is built from — `lf-card`, `lf-input`,
 * `lf-btn-*`, and the `--surface` / `--canvas` / `--ink` / `--muted` / `--line` tokens that
 * follow the light and dark themes. One codebase should look like one product, and an
 * operator who knows their way around a tenant workspace already knows their way around this.
 *
 * They live in their own file rather than reusing the tenant component library only because
 * that library reads a tenant's branding out of a session that does not exist here. The look
 * is shared; the data source is not.
 */

export function PlatformCard({
  children,
  className,
  testId,
}: {
  children: React.ReactNode
  className?: string
  testId?: string
}) {
  return (
    <div className={clsx('lf-card p-5', className)} data-testid={testId}>
      {children}
    </div>
  )
}

export function SectionHeading({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[11.5px] font-bold uppercase tracking-[0.7px] text-muted">{title}</h2>
      {blurb && <p className="text-xs text-muted mt-1">{blurb}</p>}
    </div>
  )
}

const TONES = {
  live: 'bg-success/10 text-success border-success/25',
  warn: 'bg-warning/12 text-warning-strong border-warning/30',
  bad: 'bg-danger-strong/10 text-danger-strong border-danger-strong/25',
  quiet: 'bg-canvas text-muted border-line',
  info: 'bg-brand/10 text-brand border-brand/25',
} as const

export function Pill({
  tone = 'quiet',
  children,
  testId,
}: {
  tone?: keyof typeof TONES
  children: React.ReactNode
  testId?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold',
        TONES[tone],
      )}
      data-testid={testId}
    >
      {children}
    </span>
  )
}

export function PlatformButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  busy,
  type = 'button',
  className,
  testId,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  busy?: boolean
  type?: 'button' | 'submit'
  className?: string
  testId?: string
}) {
  const look = { primary: 'lf-btn-primary', ghost: 'lf-btn-secondary', danger: 'lf-btn-danger' }[variant]

  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} data-testid={testId} className={clsx(look, className)}>
      {busy ? 'Working…' : children}
    </button>
  )
}

export function Labelled({
  label,
  hint,
  problem,
  children,
}: {
  label: string
  hint?: string
  problem?: string
  children: React.ReactNode
}) {
  return (
    <label className="block mb-4">
      <span className="lf-label">{label}</span>
      {children}
      {problem ? (
        <span className="block text-[11px] text-danger-strong mt-1">{problem}</span>
      ) : (
        hint && <span className="block text-[11px] text-muted mt-1">{hint}</span>
      )}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  testId,
  dir,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  testId?: string
  dir?: 'rtl' | 'ltr'
}) {
  return (
    <input
      type={type}
      value={value}
      dir={dir}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testId}
      className="lf-input"
    />
  )
}

/**
 * A colour, typed or picked.
 *
 * Both, because both are how people actually work: a brand guideline gives you a hex code to
 * paste, and choosing one from scratch wants a picker. They edit the same value.
 */
export function ColourInput({
  value,
  onChange,
  testId,
}: {
  value: string
  onChange: (v: string) => void
  testId?: string
}) {
  const valid = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={valid ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Pick a colour"
        data-testid={testId ? `${testId}-picker` : undefined}
        className="h-11 w-12 rounded-xl2 bg-canvas border-[1.5px] border-line cursor-pointer p-1 shrink-0"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        data-testid={testId}
        className={clsx('lf-input flex-1 font-mono', !valid && 'border-danger-strong/60')}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------------------------
 * The pieces a real administration application is built from.
 *
 * Added as a small kit rather than styled inline per page: nine screens that each invent their
 * own table and their own empty state is how an admin console ends up looking assembled rather
 * than designed.
 * ---------------------------------------------------------------------------------------- */

/** A page's title, its one-line explanation, and whatever it can be acted on with. */
export function PageHeader({
  title,
  blurb,
  actions,
  testId,
}: {
  title: string
  blurb?: string
  actions?: React.ReactNode
  testId?: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5" data-testid={testId}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-ink leading-tight">{title}</h1>
        {blurb && <p className="text-sm text-muted mt-0.5 max-w-2xl">{blurb}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

const STAT_TONES = {
  quiet: 'bg-canvas text-muted',
  good: 'bg-success/10 text-success',
  warn: 'bg-warning/12 text-warning-strong',
  bad: 'bg-danger-strong/10 text-danger-strong',
  info: 'bg-brand/10 text-brand',
} as const

/**
 * One measured number.
 *
 * `value` of `null` means the figure could not be obtained — shown as "not available" with the
 * reason, never as a zero. A zero and an unknown are different facts, and a dashboard that
 * renders them identically is lying about one of them.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  unavailable,
  icon: Icon,
  tone = 'quiet',
  testId,
}: {
  label: string
  value: number | string | null
  unit?: string
  hint?: string
  unavailable?: string
  icon?: LucideIcon
  tone?: keyof typeof STAT_TONES
  testId?: string
}) {
  return (
    <div className="lf-card lf-card-hover p-4 flex flex-col gap-2.5" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
        {Icon && (
          <span className={clsx('w-8 h-8 rounded-xl2 flex items-center justify-center shrink-0', STAT_TONES[tone])}>
            <Icon size={15} />
          </span>
        )}
      </div>

      {value === null ? (
        <p className="text-[13px] text-muted leading-snug" data-testid={testId ? `${testId}-unavailable` : undefined}>
          {unavailable ?? 'Not available'}
        </p>
      ) : (
        <p className="text-[26px] font-bold leading-none tabular-nums text-ink">
          {value}
          {unit && <span className="text-sm font-semibold text-muted ms-1">{unit}</span>}
        </p>
      )}

      {hint && <p className="text-[11px] text-muted leading-snug">{hint}</p>}
    </div>
  )
}

/** A table that scrolls sideways inside itself, so the page never does. */
export function DataTable({
  head,
  children,
  testId,
}: {
  head: React.ReactNode
  children: React.ReactNode
  testId?: string
}) {
  return (
    <div className="lf-card overflow-hidden" data-testid={testId}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="bg-canvas">
            <tr className="text-start text-[11px] font-bold uppercase tracking-wider text-muted">{head}</tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={clsx('text-start font-bold px-4 py-3 whitespace-nowrap', className)}>{children}</th>
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-3 align-middle text-ink', className)}>{children}</td>
}

/** Nothing here — said in a way that explains why, and offers the way forward. */
export function EmptyState({
  title,
  blurb,
  action,
  icon: Icon,
  testId,
}: {
  title: string
  blurb?: string
  action?: React.ReactNode
  icon?: LucideIcon
  testId?: string
}) {
  return (
    <div
      className="rounded-card border border-dashed border-line bg-surface p-10 text-center flex flex-col items-center gap-2"
      data-testid={testId}
    >
      {Icon && (
        <span className="w-12 h-12 rounded-xl2 bg-brand/10 flex items-center justify-center mb-1">
          <Icon size={22} className="text-brand" />
        </span>
      )}
      <p className="font-bold text-ink">{title}</p>
      {blurb && <p className="text-sm text-muted max-w-md">{blurb}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/** Loading, shaped roughly like what is coming, so the page does not jump when it lands. */
export function Skeleton({ rows = 3, testId }: { rows?: number; testId?: string }) {
  return (
    <div className="space-y-2" data-testid={testId}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 rounded-card bg-canvas border border-line animate-pulse" />
      ))}
    </div>
  )
}

/** Something went wrong, said plainly, with the way to try again. */
export function ErrorState({ message, onRetry, testId }: { message: string; onRetry?: () => void; testId?: string }) {
  return (
    <div
      className="rounded-card border border-danger-strong/30 bg-danger-strong/[0.06] p-6 text-center flex flex-col items-center gap-3"
      data-testid={testId}
    >
      <p className="text-sm text-danger-strong max-w-md">{message}</p>
      {onRetry && (
        <PlatformButton variant="ghost" onClick={onRetry} testId="platform-retry">
          Try again
        </PlatformButton>
      )}
    </div>
  )
}

/** A dot that says what state something is in, with the word beside it for anybody who cannot see colour. */
export function StatusDot({ state, label }: { state: 'good' | 'warn' | 'bad' | 'quiet'; label: string }) {
  const dot = {
    good: 'bg-success',
    warn: 'bg-warning',
    bad: 'bg-danger-strong',
    quiet: 'bg-muted/50',
  }[state]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
      {label}
    </span>
  )
}

/** Bytes, in the unit a person would say out loud. */
export function bytes(n: number | null): string | null {
  if (n === null) return null
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

/** A date said the way a person reads one, and nothing when there is no date. */
export function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
