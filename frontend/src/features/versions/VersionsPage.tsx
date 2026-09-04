import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, PackageOpen, Rocket, Search, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import { useVersions } from '@/hooks'
import { Spinner } from '@/components/ui'
import { APP } from '@/config/appConfig'

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function VersionsPage() {
  const { data, isLoading } = useVersions()
  const [term, setTerm] = useState('')

  const rows = useMemo(() => {
    const all = data ?? []
    const needle = term.trim().toLowerCase()
    if (!needle) return all
    return all.filter((v) =>
      [v.number, v.name, v.summary, ...v.areas, ...v.highlights].join(' ').toLowerCase().includes(needle),
    )
  }, [data, term])

  const latest = (data ?? [])[0]

  return (
    <div className="min-h-screen bg-canvas dark:bg-dk-bg" data-testid="versions-page">
      <header
        className="relative overflow-hidden text-white"
        style={{
          background:
            'linear-gradient(145deg, rgb(var(--brand-700)) 0%, rgb(var(--brand)) 55%, rgb(var(--secondary)) 100%)',
        }}
      >
        <div
          className="absolute -top-24 -end-24 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-[1080px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
          <Link to="/login" className="inline-flex items-center gap-2.5 text-white no-underline mb-8" data-testid="versions-brand">
            <span className="w-10 h-10 rounded-xl2 bg-white/15 border border-white/25 flex items-center justify-center">
              <PackageOpen size={20} />
            </span>
            <span className="font-extrabold text-lg">{APP.name}</span>
          </Link>

          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80 mb-3">
            <Sparkles size={13} /> Release notes
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight max-w-2xl">
            What changed, and how to try it
          </h1>
          <p className="text-white/80 mt-3 max-w-xl text-sm sm:text-base">
            Every release we cut, in plain language — with the exact steps to test each change yourself.
          </p>

          {latest && (
            <Link
              to={`/versions/${latest._id}`}
              className="inline-flex items-center gap-2 mt-7 rounded-xl2 bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur px-4 h-11 text-sm font-semibold text-white no-underline transition-colors"
              data-testid="versions-latest"
            >
              <Rocket size={16} /> Latest — {latest.number} · {latest.name}
              <ArrowRight size={15} className="rtl:rotate-180" />
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-[1080px] mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-navy dark:text-dk-texthi">
            {rows.length} release{rows.length === 1 ? '' : 's'}
          </h2>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="lf-input !ps-9"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search a release, an area, a change"
              data-testid="versions-search"
            />
          </div>
        </div>

        {isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="lf-card p-10 text-center" data-testid="versions-empty">
            <p className="font-semibold text-navy dark:text-dk-texthi">
              {term ? 'Nothing matches that' : 'No releases published yet'}
            </p>
            <p className="text-sm text-muted mt-1">
              {term ? 'Try a different word, or clear the search.' : 'The first release will appear here the moment it is cut.'}
            </p>
          </div>
        ) : (
          <div className="lf-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="versions-table">
                <thead className="bg-canvas dark:bg-dk-elevated text-muted">
                  <tr className="text-start">
                    <th className="text-start font-semibold px-4 py-3 whitespace-nowrap">Version</th>
                    <th className="text-start font-semibold px-4 py-3">Release</th>
                    <th className="text-start font-semibold px-4 py-3 hidden md:table-cell">What is in it</th>
                    <th className="text-start font-semibold px-4 py-3 whitespace-nowrap">Checked</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v, i) => (
                    <tr
                      key={v._id}
                      className={clsx(
                        'border-t border-line dark:border-dk-border hover:bg-brand/5 transition-colors',
                        i === 0 && 'bg-brand/[0.04]',
                      )}
                      data-testid={`versions-row-${v._id}`}
                    >
                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <Link to={`/versions/${v._id}`} className="font-mono font-bold text-brand no-underline hover:underline">
                          {v.number}
                        </Link>
                        <p className="text-[11px] text-muted mt-0.5">{dateOf(v.releasedAt)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Link
                          to={`/versions/${v._id}`}
                          className="font-semibold text-navy dark:text-dk-texthi no-underline hover:text-brand"
                        >
                          {v.name}
                        </Link>
                        <p className="text-xs text-muted mt-1 md:hidden line-clamp-2">{v.summary}</p>
                      </td>
                      <td className="px-4 py-4 align-top hidden md:table-cell">
                        <p className="text-muted line-clamp-2 max-w-[420px]">{v.summary}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {v.areas.map((area) => (
                            <span
                              key={area}
                              className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-canvas dark:bg-dk-elevated border border-line dark:border-dk-border px-2 py-0.5 text-muted"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="tabular-nums font-semibold text-navy dark:text-dk-texthi" data-testid={`versions-progress-${v._id}`}>
                          {v.checkedCount ?? 0}/{v.changeCount}
                        </p>
                        <div className="h-1.5 w-16 rounded-full bg-line dark:bg-dk-border mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${v.changeCount ? Math.round(((v.checkedCount ?? 0) / v.changeCount) * 100) : 0}%` }}
                          />
                        </div>
                        {(v.openIssues ?? 0) > 0 && (
                          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 mt-1.5" data-testid={`versions-issues-${v._id}`}>
                            {v.openIssues} open report{v.openIssues === 1 ? '' : 's'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-end">
                        <Link
                          to={`/versions/${v._id}`}
                          className="inline-flex items-center gap-1.5 text-brand font-semibold no-underline hover:underline whitespace-nowrap"
                          data-testid={`versions-open-${v._id}`}
                        >
                          Read it <ArrowRight size={14} className="rtl:rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-muted text-center mt-8">
          <Link to="/login" className="text-brand no-underline hover:underline">Back to sign in</Link>
        </p>
      </main>
    </div>
  )
}
