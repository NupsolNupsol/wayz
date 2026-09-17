import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, Mail, PackageOpen } from 'lucide-react';

import { authApi, type DemoOrganisation } from '@/api/auth.api';
import { homeForRole } from '@/permissions/permissions';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { resetTenantBranding } from '@/store/branding';

/**
 * One door, for everybody.
 *
 * The product used to have a sign-in page per organisation, reached at its own address and
 * wearing its own colours before anybody had typed anything. That made the address the thing
 * that decided which company you were signing in to — so a person had to know their company's
 * handle, and landing on the wrong one failed in a way that looked like a bad password.
 *
 * This page belongs to nobody. It carries the neutral palette deliberately: at this point the
 * product genuinely does not know whose employee is standing at it. The account answers that —
 * sign-in finds the person, their organisation follows from the record, and the colours are
 * applied the moment the session exists (see `useAuthStore.setSession`).
 *
 * Branding after login, never before. That is the whole of it.
 */
export function SignInPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setPlatformSession = useAuthStore((s) => s.setPlatformSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [organisations, setOrganisations] = useState<DemoOrganisation[]>([]);

  /*
   * The door wears the platform's own palette, not the last organisation's.
   *
   * Without this, signing out of one company left its colours painted over a page that belongs
   * to no company — and the next person to sign in saw somebody else's brand while typing.
   */
  useEffect(() => {
    resetTenantBranding();
  }, []);

  useEffect(() => {
    authApi
      .demoLogins()
      .then((r) => setOrganisations(r.organisations))
      .catch(() => setOrganisations([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.login(email, password);

      /*
       * Whoever runs the platform comes through this same door and leaves by a different one.
       *
       * They have no organisation, so there is no branding to apply and no workspace to land
       * in — the console is their whole surface.
       */
      if (result.platform) {
        setPlatformSession(result.token, result.platform);
        navigate('/platform', { replace: true });
        return;
      }

      setSession(result.token, result.user);

      /*
       * To the workspace this person's job actually opens, not to "/".
       *
       * "/" sends everybody to the dashboard, and only roles outside AGENT_ROLES are bounced
       * from there to somewhere they belong. A chief captain is inside AGENT_ROLES, so signing
       * in dropped them on the agent dashboard rather than on their board.
       */
      navigate(homeForRole(result.user.role), { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('login.failed', { defaultValue: 'Could not sign in.' })
      );
    } finally {
      setLoading(false);
    }
  };

  const useProfile = (profileEmail: string, profilePassword: string) => {
    setEmail(profileEmail);
    setPassword(profilePassword);
    setError('');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at 60% 40%, rgb(var(--brand) / 0.12) 0%, rgb(var(--canvas)) 60%)',
      }}
      data-testid="sign-in-page"
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
            <h1 className="text-3xl font-extrabold z-10" data-testid="sign-in-title">
              {t('login.productName', { defaultValue: 'LockerFlow' })}
            </h1>
            <p className="text-sm text-white/75 text-center z-10 max-w-xs">
              {t('login.productBlurb', {
                defaultValue: 'One workspace for every activity your organisation runs.',
              })}
            </p>
            <div
              className="absolute -top-16 -end-16 w-72 h-72 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="flex-1 flex items-center justify-center p-8 sm:p-12">
            <form onSubmit={submit} className="w-full max-w-[340px]" data-testid="login-form">
              <h2 className="text-2xl font-extrabold text-navy mb-2">{t('login.welcome')}</h2>
              <p className="text-sm text-muted mb-8">
                {t('login.neutralSubtitle', {
                  defaultValue:
                    'Sign in with your work address. We will take you to your organisation.',
                })}
              </p>

              <label className="lf-label">{t('login.email')}</label>
              <div className="relative mb-4">
                <Mail size={17} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  data-testid="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="lf-input !h-12 !ps-11"
                  required
                />
              </div>

              <label className="lf-label">{t('login.password')}</label>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="relative flex-1">
                  <Lock
                    size={17}
                    className="absolute start-4 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    data-testid="login-password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="lf-input !h-12 !ps-11"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="w-12 h-12 shrink-0 rounded-xl2 bg-canvas border-[1.5px] border-line flex items-center justify-center text-muted hover:bg-navy-50"
                  aria-label={t('login.togglePassword')}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p
                  className="text-sm text-danger-strong mt-2"
                  role="alert"
                  data-testid="login-error"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                data-testid="login-submit"
                disabled={loading}
                className="lf-btn-primary w-full !h-[50px] mt-6"
              >
                {loading
                  ? t('login.signingIn', { defaultValue: 'Signing in…' })
                  : t('login.signIn')}
              </button>
            </form>

            {/*
              The release notes, reachable before anybody signs in.

              What changed in a release, and how to check it, is most useful to somebody who
              cannot get in yet — so the page is public and the way to it belongs on the door.
            */}
            <div className="mt-5 text-center">
              <Link
                to="/versions"
                data-testid="login-versions"
                className="text-xs text-muted hover:text-fg underline underline-offset-4"
              >
                {t('login.releaseNotes', { defaultValue: "What's new" })}
              </Link>
            </div>
          </div>
        </div>

        {/*
          Demonstration accounts, grouped by the organisation each belongs to.
          Served only by a deployment that has declared itself a demonstration; on any other
          the list comes back empty and this whole block never renders.
        */}
        {organisations.length > 0 && (
          <div className="mt-6" data-testid="demo-logins">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
              {t('login.demoAccounts', { defaultValue: 'Demonstration accounts' })}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {organisations.map((org) => (
                <div
                  key={org.id}
                  className="bg-surface rounded-2xl p-4 shadow-sm"
                  data-testid={`demo-org-${org.id}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-6 h-6 rounded-lg shrink-0"
                      style={{ backgroundColor: org.branding?.primaryColor ?? 'rgb(var(--brand))' }}
                    />
                    <p className="font-bold text-navy text-sm">{org.name}</p>
                    <span className="ms-auto text-[11px] text-muted">
                      {org.activities.length} activities
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {org.logins.map((p) => (
                      <button
                        key={p.email}
                        type="button"
                        onClick={() => useProfile(p.email, p.password)}
                        data-testid={`demo-login-${p.email}`}
                        className="text-start px-2.5 py-1.5 rounded-lg hover:bg-canvas transition-colors"
                      >
                        <span className="text-[13px] font-medium text-navy">{p.label}</span>
                        <span className="block text-[11px] text-muted font-mono">{p.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
