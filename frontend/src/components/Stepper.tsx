import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

const revisitStyle = (on: boolean) =>
  on ? 'cursor-pointer hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/30' : ''

export interface Step {
  key: string
  label?: string
  labelKey?: string
}

export function Stepper({
  steps,
  current,
  onStep,
  canRevisit,
}: {
  steps: Step[]
  current: number
  onStep?: (index: number) => void
  canRevisit?: (index: number) => boolean
}) {
  const { t } = useTranslation('common')
  const wordFor = (step: Step) => (step.labelKey ? t(step.labelKey) : (step.label ?? step.key))

  return (
    <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1" data-testid="stepper">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const revisitable = !!onStep && done && (canRevisit ? canRevisit(i) : true)
        return (
          <li key={s.key} className="flex items-center gap-1 shrink-0">
            <div
              role={revisitable ? 'button' : undefined}
              tabIndex={revisitable ? 0 : undefined}
              onClick={revisitable ? () => onStep(i) : undefined}
              onKeyDown={revisitable ? (e) => (e.key === 'Enter' || e.key === ' ') && onStep(i) : undefined}
              title={revisitable ? t('action.goBackTo', { step: wordFor(s) }) : undefined}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                active && 'bg-brand text-white border-brand',
                done && 'bg-emerald-50 text-success border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800',
                !active && !done && 'bg-white text-muted border-line dark:bg-dk-elevated dark:border-dk-border',
                revisitStyle(revisitable),
              )}
              data-testid={`step-${s.key}`}
              data-state={active ? 'active' : done ? 'done' : 'pending'}
              data-revisitable={revisitable ? 'yes' : 'no'}
            >
              <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[10px]', active ? 'bg-white/20' : done ? '' : 'bg-slate-100 dark:bg-dk-muted')}>
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{wordFor(s)}</span>
            </div>
            {i < steps.length - 1 && <div className="w-4 h-px bg-line shrink-0" />}
          </li>
        )
      })}
    </ol>
  )
}
