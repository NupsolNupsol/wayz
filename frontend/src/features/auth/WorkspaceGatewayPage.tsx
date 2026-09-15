import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, PackageOpen, ShieldCheck } from 'lucide-react'

import { authApi, type WorkspaceSummary } from '@/api/auth.api'

/**
 * The platform's own front door.
 *
 * This page exists because `/login` used to be WAYZ's. It carried WAYZ's name, WAYZ's colours
 * and a hard-coded list of WAYZ's staff accounts, which meant the root of a multi-tenant
 * product quietly meant whichever tenant happened to be built first. Every tenant added
 * afterwards was a second-class citizen of its own platform.
 *
 * So this door belongs to nobody. It names no tenant, wears no tenant's colours and knows no
 * tenant's accounts. Its only job is to send you to the right one — after which `/t/<handle>/
 * login` is that company's door and looks like it.
 *
 * On a demonstration deployment it lists the workspaces to save typing. On a real one that
 * list is empty by design and the handle is typed, because publishing the names of every
 * company on the platform to anybody who loads the page is not something a real deployment
 * should do.
 */
export function WorkspaceGatewayPage() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null)
  const [handle, setHandle] = useState('')

  useEffect(() => {
    let live = true
    authApi
      .workspaces()
      .then((rows) => live && setWorkspaces(rows))
      .catch(() => live && setWorkspaces([]))
    return () => {
      live = false
    }
  }, [])

  const go = (slug: string) => navigate(`/t/${slug.trim().toLowerCase()}/login`)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (handle.trim()) go(handle)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 60% 40%, rgb(var(--brand) / 0.10) 0%, rgb(var(--canvas)) 60%)' }}
      data-testid="workspace-gateway"
    >
      <div className="w-full max-w-[520px]">
        <div className="bg-surface rounded-[28px] shadow-pop p-8 sm:p-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-brand/10 flex items-center justify-center shrink-0">
              <PackageOpen size={22} className="text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-ink leading-tight">LockerFlow</h1>
              <p className="text-xs text-muted">Multi-tenant operations platform</p>
            </div>
          </div>

          <p className="text-sm text-muted mt-5 mb-6">
            Every company on LockerFlow has its own workspace, its own data and its own sign-in
            page. Choose yours to continue.
          </p>

          {workspaces === null ? (
            <div className="space-y-2" data-testid="workspace-loading">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[62px] rounded-2xl bg-canvas animate-pulse" />
              ))}
            </div>
          ) : workspaces.length > 0 ? (
            <div className="space-y-2" data-testid="workspace-list">
              {workspaces.map((w) => (
                <button
                  key={w.slug}
                  type="button"
                  onClick={() => go(w.slug)}
                  data-testid={`workspace-${w.slug}`}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-line hover:border-brand hover:bg-brand/5 transition text-left group"
                >
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden"
                    style={{ backgroundColor: w.branding.primaryColor || '#0f172a' }}
                  >
                    {w.branding.logoUrl ? (
                      <img src={w.branding.logoUrl} alt="" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      (w.branding.logoText || w.name).slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink truncate">{w.name}</span>
                    <span className="block text-xs text-muted truncate">/t/{w.slug}</span>
                  </span>
                  <ArrowRight size={16} className="text-muted group-hover:text-brand shrink-0" />
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={submit} className={workspaces && workspaces.length > 0 ? 'mt-6' : 'mt-2'}>
            {workspaces && workspaces.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] uppercase tracking-wider text-muted">or</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <label className="block text-xs font-semibold text-muted mb-1.5" htmlFor="workspace-handle">
              Workspace handle
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Building2 size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="workspace-handle"
                  data-testid="workspace-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="your-company"
                  autoComplete="organization"
                  className="w-full h-11 ps-9 pe-3 rounded-xl border border-line bg-canvas text-sm text-ink outline-none focus:border-brand"
                />
              </div>
              <button
                type="submit"
                data-testid="workspace-continue"
                disabled={!handle.trim()}
                className="h-11 px-5 rounded-xl bg-brand text-brand-fg text-sm font-semibold disabled:opacity-40 hover:bg-brand-600 transition"
              >
                Continue
              </button>
            </div>
          </form>
        </div>

        <a
          href="/platform/login"
          data-testid="gateway-platform-link"
          className="mt-4 flex items-center justify-center gap-2 text-xs text-muted hover:text-ink transition"
        >
          <ShieldCheck size={14} />
          Platform administration
        </a>
      </div>
    </div>
  )
}
