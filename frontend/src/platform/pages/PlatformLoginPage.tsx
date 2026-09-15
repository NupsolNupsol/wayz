import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Layers, Lock, Mail, ShieldCheck } from 'lucide-react'

import { ApiError } from '@/api/client'
import { platformApi } from '../platformApi'
import { usePlatformSession } from '../platformClient'

/**
 * The way in to the control plane, and deliberately not the way in to anything else.
 *
 * It looks different from a tenant's login on purpose. Somebody who administers the platform
 * also has accounts inside tenants, and the two do very different things: one creates
 * companies, the other sells a customer a scooter. A page that looked the same would invite
 * the wrong credentials and, worse, the wrong mental model about what this session can reach.
 *
 * There is no signup link and no password reset, because neither exists. Platform
 * administrators are created by whoever holds the server's environment.
 */
export function PlatformLoginPage() {
  const navigate = useNavigate()
  const signIn = usePlatformSession((s) => s.signIn)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      const { token, admin } = await platformApi.signIn(email, password)
      signIn(token, admin)
      navigate('/platform', { replace: true })
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 60% 40%, rgb(var(--brand) / 0.12) 0%, rgb(var(--canvas)) 60%)' }}
      data-testid="platform-login-page"
    >
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-canvas border border-line backdrop-blur flex items-center justify-center mb-4">
            <Layers size={30} className="text-brand-fg" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink">LockerFlow Platform</h1>
          <p className="text-sm text-muted mt-1.5 max-w-[300px]">
            The control plane. Companies are created and configured here — not operated.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[22px] bg-surface border border-line backdrop-blur p-7"
          data-testid="platform-login-form"
        >
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">Email</label>
          <div className="relative mb-4">
            <Mail size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              data-testid="platform-login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full h-12 ps-10 pe-3 rounded-xl bg-canvas border border-line text-ink placeholder:text-muted outline-none focus:border-brand transition-colors"
              placeholder="super@lockerflow.demo"
            />
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">Password</label>
          <div className="relative mb-6">
            <Lock size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              data-testid="platform-login-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full h-12 ps-10 pe-11 rounded-xl bg-canvas border border-line text-ink placeholder:text-muted outline-none focus:border-brand transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {problem && (
            <p className="text-sm text-danger-strong mb-4" role="alert" data-testid="platform-login-error">
              {problem}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="platform-login-submit"
            className="w-full h-12 rounded-xl2 bg-brand text-brand-fg font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-brand-600 transition-colors"
          >
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} />
          </button>

          <p className="flex items-start gap-2 text-[11px] text-muted mt-5 leading-relaxed">
            <ShieldCheck size={14} className="shrink-0 mt-px" />
            This sign-in reaches no tenant’s data. Company staff sign in at their own address.
          </p>
        </form>
      </div>
    </div>
  )
}
