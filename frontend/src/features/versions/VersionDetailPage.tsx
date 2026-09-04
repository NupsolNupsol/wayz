import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, ExternalLink, FlaskConical, PackageOpen, Sparkles, Users } from 'lucide-react'
import { useVersion } from '@/hooks'
import { ChangeVerdict } from './ChangeVerdict'
import { Spinner } from '@/components/ui'
import { APP } from '@/config/appConfig'

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

export function VersionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError } = useVersion(id)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas dark:bg-dk-bg grid place-items-center" data-testid="version-detail">
        <Spinner />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-canvas dark:bg-dk-bg grid place-items-center px-6" data-testid="version-detail">
        <div className="lf-card p-8 text-center max-w-md">
          <p className="font-bold text-navy dark:text-dk-texthi mb-1">That release is not here</p>
          <p className="text-sm text-muted mb-5">It may have been renamed or not published yet.</p>
          <Link to="/versions" className="lf-btn-primary no-underline inline-flex" data-testid="version-back">
            All releases
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-dk-bg" data-testid="version-detail">
      <header
        className="relative overflow-hidden text-white"
        style={{
          background:
            'linear-gradient(145deg, rgb(var(--brand-700)) 0%, rgb(var(--brand)) 55%, rgb(var(--secondary)) 100%)',
        }}
      >
        <div
          className="absolute -bottom-24 -start-16 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-[900px] mx-auto px-5 sm:px-8 py-9 sm:py-12">
          <div className="flex items-center justify-between gap-3 mb-8">
            <Link to="/versions" className="inline-flex items-center gap-2 text-white/85 hover:text-white no-underline text-sm font-semibold" data-testid="version-back">
              <ArrowLeft size={16} className="rtl:rotate-180" /> All releases
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 text-white no-underline">
              <PackageOpen size={18} />
              <span className="font-extrabold">{APP.name}</span>
            </Link>
          </div>

          <p className="font-mono text-sm text-white/80 mb-2">{data.number} · {dateOf(data.releasedAt)}</p>
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">{data.name}</h1>
          <p className="text-white/85 mt-3 max-w-2xl text-sm sm:text-base">{data.summary}</p>

          {data.highlights.length > 0 && (
            <ul className="flex flex-wrap gap-2 mt-6" data-testid="version-highlights">
              {data.highlights.map((h) => (
                <li
                  key={h}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 backdrop-blur px-3 py-1.5 text-xs font-semibold"
                >
                  <Sparkles size={12} /> {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 sm:px-8 py-8 sm:py-10 flex flex-col gap-5">
        {data.changes.map((change, i) => (
          <article className="lf-card p-5 sm:p-6" key={`${change.title}-${i}`} data-testid={`version-change-${i}`}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider rounded-full bg-brand/10 text-brand px-2.5 py-1">
                {change.area}
              </span>
              {change.roles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full border border-line dark:border-dk-border px-2 py-0.5 text-muted"
                >
                  <Users size={10} /> {role}
                </span>
              ))}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-navy dark:text-dk-texthi">{change.title}</h2>
            {change.detail && <p className="text-sm text-muted mt-2 leading-relaxed">{change.detail}</p>}

            {change.howToTest.length > 0 && (
              <div className="mt-4 rounded-xl2 border border-line dark:border-dk-border bg-canvas dark:bg-dk-elevated p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy dark:text-dk-texthi mb-3">
                  <FlaskConical size={14} className="text-brand" /> How to test it
                </p>
                <ol className="flex flex-col gap-2.5" data-testid={`version-steps-${i}`}>
                  {change.howToTest.map((step, n) => (
                    <li key={n} className="flex gap-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-brand text-brand-fg text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {n + 1}
                      </span>
                      <span className="text-navy dark:text-dk-text leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(change.links ?? []).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2" data-testid={`version-links-${i}`}>
                {(change.links ?? []).map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="inline-flex items-center gap-1.5 rounded-xl2 border border-brand/40 bg-brand/5 hover:bg-brand/10 text-brand text-xs font-semibold px-3 h-9 no-underline transition-colors"
                  >
                    <ExternalLink size={13} /> {link.label}
                  </Link>
                ))}
              </div>
            )}

            {change.expect && (
              <div className="mt-3 flex gap-2.5 rounded-xl2 border border-success/40 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <CircleCheck size={16} className="text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-success mb-1">What you should see</p>
                  <p className="text-sm text-navy dark:text-dk-text leading-relaxed">{change.expect}</p>
                </div>
              </div>
            )}
            <ChangeVerdict versionId={data._id} index={i} change={change} />
          </article>
        ))}

        <p className="text-xs text-muted text-center mt-2">
          <Link to="/versions" className="text-brand no-underline hover:underline">Every release</Link>
          {' · '}
          <Link to="/login" className="text-brand no-underline hover:underline">Sign in</Link>
        </p>
      </main>
    </div>
  )
}
