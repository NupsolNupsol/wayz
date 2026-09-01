import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useStatusLabel, type StatusGroup } from '@/i18n/useStatusLabel'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { statusTone, type Tone } from './status'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const cls = {
    primary: 'lf-btn-primary',
    secondary: 'lf-btn-secondary',
    ghost: 'lf-btn-ghost',
    danger: 'lf-btn-danger',
    success: 'lf-btn-success',
  }[variant]
  return (
    <button className={clsx(cls, className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('lf-card p-5', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx('lf-section-title', className)}>{children}</h2>
}

export function FieldGroupTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx('flex items-center gap-1.5 lf-label mt-1 mb-2 border-b border-line dark:border-dk-border pb-1.5', className)}>
      {children}
    </p>
  )
}

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-dk-elevated dark:text-dk-text',
  info: 'bg-blue-50 text-brand dark:bg-dk-elevated dark:text-accent',
  success: 'bg-emerald-50 text-success dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-red-50 text-danger-strong dark:bg-red-900/30 dark:text-red-300',
}
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('lf-chip', BADGE_TONES[tone], className)}>{children}</span>
}

export function StatusBadge({ status, group }: { status: string; group?: StatusGroup }) {
  const label = useStatusLabel()
  return <Badge tone={statusTone(status)}>{label(status, group)}</Badge>
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 text-muted text-sm py-8 justify-center">
      <Loader2 className="animate-spin" size={18} /> {label ?? t('state.loading')}
    </div>
  )
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-navy-50 dark:bg-dk-elevated flex items-center justify-center text-brand mb-4">{icon}</div>
      <h3 className="font-semibold text-navy dark:text-dk-texthi">{title}</h3>
      {message && <p className="text-sm text-muted mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({ label, htmlFor, hint, error, children, required, className }: { label: string; htmlFor?: string; hint?: string; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-4', className)}>
      <label htmlFor={htmlFor} className="lf-label">
        {label} {required && <span className="text-danger-strong">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted mt-1">{hint}</p>}
      {error && <p className="text-xs text-danger-strong mt-1" role="alert">{error}</p>}
    </div>
  )
}

export function StatCard({ label, value, icon, tone = 'neutral', onClick, testId, sublabel }: { label: string; value: ReactNode; icon?: ReactNode; tone?: keyof typeof BADGE_TONES; onClick?: () => void; testId?: string; sublabel?: string }) {
  const toneBar: Record<string, string> = {
    neutral: 'text-navy', info: 'text-brand', success: 'text-success', warning: 'text-amber-500', danger: 'text-danger-strong',
  }
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={clsx('lf-card lf-card-hover p-4 text-start w-full', onClick ? 'cursor-pointer' : 'cursor-default')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className={clsx('text-2xl font-bold mt-1', toneBar[tone])}>{value}</p>
          {sublabel && <p className="text-xs text-muted mt-0.5">{sublabel}</p>}
        </div>
        {icon && <div className={clsx('shrink-0', toneBar[tone])}>{icon}</div>}
      </div>
    </button>
  )
}
