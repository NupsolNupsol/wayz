import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { hasManualSection } from '@/config/manual'

export interface Crumb {
  label: string
  to?: string
}

export function PageHeader({
  title,
  subtitle: _subtitle,
  crumbs,
  actions,
  helpId,
  backTo,
}: {
  title: string
  subtitle?: string
  crumbs?: Crumb[]
  actions?: ReactNode
  helpId?: string
  backTo?: string
}) {
  const { t } = useTranslation('common')
  const showHelp = !!helpId && hasManualSection(helpId)
  const navigate = useNavigate()
  const backLabel = t('action.back')

  const parent = backTo ?? [...(crumbs ?? [])].reverse().find((c) => !!c.to)?.to
  const goBack = () => (parent ? navigate(parent) : navigate(-1))

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {(parent || window.history.length > 1) && (
              <button
                type="button"
                onClick={goBack}
                aria-label={backLabel}
                title={backLabel}
                data-testid="page-back"
                className="shrink-0 -ms-1 p-1.5 rounded-lg text-muted hover:text-navy hover:bg-black/5 dark:hover:text-dk-texthi"
              >
                <ArrowLeft size={18} className="rtl:rotate-180" />
              </button>
            )}
            <h1 className="text-2xl font-bold text-navy dark:text-dk-texthi">{title}</h1>
            {showHelp && (
              <Link
                to={`/help/manual#${helpId}`}
                title={`How to use this page — ${title}`}
                aria-label={`Open the manual for ${title}`}
                data-testid="page-help"
                className="text-muted hover:text-brand transition-colors no-underline shrink-0"
              >
                <CircleHelp size={18} />
              </Link>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  )
}
