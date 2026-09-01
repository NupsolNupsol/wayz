import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Eye, EyeOff, Lock, PackageOpen, TriangleAlert, X } from 'lucide-react'
import { clsx } from 'clsx'
import { authApi, type Invitation } from '@/api/auth.api'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { homeForRole } from '@/permissions/permissions'
import { APP } from '@/config/appConfig'

const MIN_LENGTH = 8

interface Rule {
  id: string
  label: string
  ok: (password: string, confirm: string, email: string) => boolean
}

const RULES: Rule[] = [
  { id: 'length', label: `At least ${MIN_LENGTH} characters`, ok: (p) => p.length >= MIN_LENGTH },
  { id: 'letter', label: 'Contains a letter', ok: (p) => /[a-zA-Z]/.test(p) },
  { id: 'number', label: 'Contains a number', ok: (p) => /[0-9]/.test(p) },
  { id: 'email', label: 'Is not your email address', ok: (p, _c, email) => p.toLowerCase() !== email.toLowerCase() },
  { id: 'match', label: 'Both entries match', ok: (p, c) => p.length > 0 && p === c },
]

export function InvitationPage() {
  const { t } = useTranslation(['auth', 'common'])
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    authApi
      .invitation(token)
      .then((data) => {
        if (!cancelled) setInvitation(data)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'That invitation link is not valid.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const email = invitation?.email ?? ''
  const checks = RULES.map((r) => ({ ...r, passed: r.ok(password, confirm, email) }))
  const ready = checks.every((c) => c.passed)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setError('')
    setSaving(true)
    try {
      const { token: authToken, user } = await authApi.acceptInvitation(token, password, confirm)
      setSession(authToken, user)
      navigate(homeForRole(user.role))
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.join(' ') ?? err.message) : 'Could not set your password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-dk-bg flex items-center justify-center p-4" data-testid="invitation-page">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl2 bg-navy flex items-center justify-center shrink-0">
            <PackageOpen size={26} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-navy dark:text-dk-texthi">{invitation?.tenantName || APP.name}</p>
            <p className="text-sm text-muted">{t('invitation.title')}</p>
          </div>
        </div>

        <div className="lf-card p-6">
          {loading && (
            <p className="text-sm text-muted text-center py-8" data-testid="invitation-loading">{t('invitation.checking')}</p>
          )}

          {!loading && loadError && (
            <div className="text-center py-4" data-testid="invitation-invalid">
              <TriangleAlert size={30} className="text-amber-500 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-navy dark:text-dk-texthi">{t('invitation.dead')}</h1>
              <p className="text-sm text-muted mt-2">{loadError}</p>
              <p className="text-sm text-muted mt-4">{t('invitation.deadMessage')}</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="lf-btn-secondary mt-5 mx-auto"
                data-testid="invitation-to-login"
              >{t('invitation.goToSignIn')}</button>
            </div>
          )}

          {!loading && invitation && (
            <form onSubmit={submit}>
              <h1 className="text-lg font-bold text-navy dark:text-dk-texthi">Welcome, {invitation.fullName}</h1>
              <p className="text-sm text-muted mt-1 mb-5">{t('invitation.ready')}<strong className="text-navy dark:text-dk-text">{invitation.roleLabel}</strong>.
                Choose a password only you know — nobody at the company can see it.
              </p>

              <div className="rounded-xl2 bg-canvas dark:bg-dk-elevated px-3.5 py-2.5 mb-4">
                <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{t('invitation.willSignInWith')}</p>
                <p className="text-sm font-medium text-navy dark:text-dk-text" data-testid="invitation-email">
                  {invitation.email}
                </p>
              </div>

              <label className="lf-label" htmlFor="invite-password">{t('invitation.newPassword')}</label>
              <div className="relative mb-3">
                <Lock size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="invite-password"
                  type={show ? 'text' : 'password'}
                  className="lf-input ps-9 pe-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  data-testid="invitation-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  data-testid="invitation-toggle"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <label className="lf-label" htmlFor="invite-confirm">{t('invitation.confirmPassword')}</label>
              <div className="relative mb-4">
                <Lock size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="invite-confirm"
                  type={show ? 'text' : 'password'}
                  className="lf-input ps-9"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  data-testid="invitation-confirm"
                />
              </div>

              <ul className="space-y-1 mb-5" data-testid="invitation-rules">
                {checks.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-xs" data-testid={`invitation-rule-${c.id}`}>
                    {c.passed ? (
                      <Check size={14} className="text-success shrink-0" />
                    ) : (
                      <X size={14} className="text-muted/60 shrink-0" />
                    )}
                    <span className={clsx(c.passed ? 'text-navy dark:text-dk-text' : 'text-muted')}>{c.label}</span>
                  </li>
                ))}
              </ul>

              {error && (
                <p className="text-sm text-danger-strong mb-3" role="alert" data-testid="invitation-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="lf-btn-primary w-full justify-center"
                disabled={!ready || saving}
                data-testid="invitation-submit"
              >
                {saving ? 'Setting your password…' : 'Set password and sign in'}
              </button>

              <p className="text-[11px] text-muted text-center mt-4">
                This link works once and expires on{' '}
                {new Date(invitation.expiresAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
