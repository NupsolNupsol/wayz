import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
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
  labelKey: string
  ok: (password: string, confirm: string, email: string) => boolean
}

const RULES: Rule[] = [
  { id: 'length', labelKey: 'invitation.ruleLength', ok: (p) => p.length >= MIN_LENGTH },
  { id: 'letter', labelKey: 'invitation.ruleLetter', ok: (p) => /[a-zA-Z]/.test(p) },
  { id: 'number', labelKey: 'invitation.ruleNumber', ok: (p) => /[0-9]/.test(p) },
  { id: 'email', labelKey: 'invitation.ruleEmail', ok: (p, _c, email) => p.toLowerCase() !== email.toLowerCase() },
  { id: 'match', labelKey: 'invitation.ruleMatch', ok: (p, c) => p.length > 0 && p === c },
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
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : t('invitation.notValid'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, t])

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
      setError(err instanceof ApiError ? (err.errors?.join(' ') ?? err.message) : t('invitation.couldNotSet'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 60% 40%, rgb(var(--brand) / 0.12) 0%, rgb(var(--canvas)) 60%)',
      }}
      data-testid="invitation-page"
    >
      <div className="w-full max-w-[1000px]">
        <div className="flex flex-col-reverse md:flex-row bg-surface rounded-[28px] overflow-hidden shadow-pop min-h-[520px]">
          <div
            className="relative flex-1 flex flex-col items-center justify-center gap-4 p-10 text-white overflow-hidden"
            style={{
              background:
                'linear-gradient(145deg, rgb(var(--brand-700)) 0%, rgb(var(--brand)) 60%, rgb(var(--secondary)) 100%)',
            }}
          >
            <div className="w-[110px] h-[110px] rounded-full bg-white/12 border border-white/25 backdrop-blur flex items-center justify-center z-10">
              <PackageOpen size={54} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold z-10">{invitation?.tenantName || APP.name}</h1>
            <p className="text-sm text-white/75 text-center z-10 max-w-xs">{t('invitation.blurb')}</p>
            <div
              className="absolute -top-16 -end-16 w-72 h-72 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)' }}
            />
          </div>

          <div className="flex-1 flex items-center justify-center p-8 sm:p-12">
            <div className="w-full max-w-[360px]">
              {loading && (
                <p className="text-sm text-muted text-center py-8" data-testid="invitation-loading">
                  {t('invitation.checking')}
                </p>
              )}

              {!loading && loadError && (
                <div className="text-center py-4" data-testid="invitation-invalid">
                  <TriangleAlert size={30} className="text-amber-500 mx-auto mb-3" />
                  <h2 className="text-2xl font-extrabold text-navy dark:text-dk-texthi">{t('invitation.dead')}</h2>
                  <p className="text-sm text-muted mt-2">{loadError}</p>
                  <p className="text-sm text-muted mt-4">{t('invitation.deadMessage')}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="lf-btn-secondary mt-6 mx-auto !h-12"
                    data-testid="invitation-to-login"
                  >
                    {t('invitation.goToSignIn')}
                  </button>
                </div>
              )}

              {!loading && invitation && (
                <form onSubmit={submit}>
                  <h2 className="text-2xl font-extrabold text-navy dark:text-dk-texthi mb-2">
                    {t('invitation.welcome', { name: invitation.fullName })}
                  </h2>
                  <p className="text-sm text-muted mb-6">
                    <Trans
                      i18nKey="auth:invitation.readyLine"
                      values={{ role: invitation.roleLabel }}
                      components={{ strong: <strong className="text-navy dark:text-dk-text" /> }}
                    />
                  </p>

                  <div className="rounded-xl2 bg-canvas dark:bg-dk-elevated border border-line dark:border-dk-border px-4 py-3 mb-5">
                    <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">
                      {t('invitation.willSignInWith')}
                    </p>
                    <p className="text-sm font-medium text-navy dark:text-dk-text" data-testid="invitation-email">
                      {invitation.email}
                    </p>
                  </div>

                  <label className="lf-label" htmlFor="invite-password">{t('invitation.newPassword')}</label>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="relative flex-1">
                      <Lock size={17} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        id="invite-password"
                        type={show ? 'text' : 'password'}
                        className="lf-input !h-12 !ps-11"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        autoFocus
                        data-testid="invitation-password"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="w-12 h-12 shrink-0 rounded-xl2 bg-canvas border-[1.5px] border-line flex items-center justify-center text-muted hover:bg-navy-50"
                      aria-label={show ? t('invitation.hidePassword') : t('invitation.showPassword')}
                      data-testid="invitation-toggle"
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <label className="lf-label" htmlFor="invite-confirm">{t('invitation.confirmPassword')}</label>
                  <div className="relative mb-5">
                    <Lock size={17} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="invite-confirm"
                      type={show ? 'text' : 'password'}
                      className="lf-input !h-12 !ps-11"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      data-testid="invitation-confirm"
                    />
                  </div>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-6" data-testid="invitation-rules">
                    {checks.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-xs" data-testid={`invitation-rule-${c.id}`}>
                        {c.passed ? (
                          <Check size={14} className="text-success shrink-0" />
                        ) : (
                          <X size={14} className="text-muted/60 shrink-0" />
                        )}
                        <span className={clsx(c.passed ? 'text-navy dark:text-dk-text' : 'text-muted')}>
                          {t(c.labelKey, { count: MIN_LENGTH })}
                        </span>
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
                    className="lf-btn-primary w-full justify-center !h-12"
                    disabled={!ready || saving}
                    data-testid="invitation-submit"
                  >
                    {saving ? t('invitation.settingPassword') : t('invitation.setPassword')}
                  </button>

                  <p className="text-[11px] text-muted text-center mt-4">
                    {t('invitation.worksOnce', {
                      date: new Date(invitation.expiresAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }),
                    })}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
