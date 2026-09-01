import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleHelp } from 'lucide-react'
import { hasManualSection } from '@/config/manual'

export interface Crumb {
  label: string
  to?: string
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
  helpId,
}: {
  title: string
  subtitle?: string
  crumbs?: Crumb[]
  actions?: ReactNode
  helpId?: string
}) {
  const showHelp = !!helpId && hasManualSection(helpId)

  return (
    <div className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted mb-2" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.to ? <Link to={c.to} className="hover:text-navy no-underline">{c.label}</Link> : <span className="text-navy dark:text-dk-text font-medium">{c.label}</span>}
              {i < crumbs.length - 1 && <ChevronRight size={12} />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
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
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  )
}
