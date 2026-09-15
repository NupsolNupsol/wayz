import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail, PackageOpen, Rocket } from "lucide-react";
import { authApi, type TenantFront } from "@/api/auth.api";
import { tenantFront } from "@/store/tenant";
import { applyTenantBranding } from "@/store/branding";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { homeForRole } from "@/permissions/permissions";

/*
 * There is no list of accounts in this file any more, and that is the point.
 *
 * It used to hold WAYZ's staff — fourteen of them, with their passwords — and show them on
 * every sign-in page the product had. A second tenant was therefore invited to sign in with a
 * first tenant's credentials, which is as wrong as it sounds and could not work.
 *
 * What a tenant may advertise now comes from that tenant's own database, and only for
 * accounts whose recorded password has been checked against the stored hash. See
 * `platform/demoLogins.ts`. When a deployment says it is not a demonstration, the list is
 * empty everywhere and nothing here changes to make that true.
 */


export function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate();
  const { slug } = useParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /*
   * Whose front door this is.
   *
   * Reached at /t/<handle>/login it belongs to one company: it wears that company's colours,
   * lists that company's own seeded accounts, and posts the handle so the sign-in resolves to
   * that company's database rather than being looked up from the address typed in. Reached at
   * /login it is the platform's own door and the directory decides, which is what every
   * existing bookmark and every existing test does.
   */
  const [front, setFront] = useState<TenantFront | null>(null);
  /*
   * Whether the answer has come back yet — which is a different question from whether there
   * is a tenant.
   *
   * Without it the page renders its branded panel in the platform's own colours for the
   * fraction of a second before the tenant's arrive. That flash is the "WIQAR identity with
   * WAYZ colours" the client saw: a real half-branded frame, not a CSS problem. A tenant's
   * door shows nothing rather than the wrong thing.
   */
  const [resolved, setResolved] = useState(false);

  /*
   * Landing here without a handle is an address from before the platform had tenants.
   *
   * `/login` is the platform's own door now and belongs to no company; it cannot show a
   * sign-in form, because there is no database to sign in to until a workspace is chosen.
   * Old bookmarks are sent to the gateway to choose one. This is the documented redirect,
   * and the only back-compatibility this route keeps.
   */
  useEffect(() => {
    if (!slug) navigate('/login', { replace: true });
  }, [slug, navigate]);

  useEffect(() => {
    if (!slug) {
      setFront(null);
      return;
    }
    let live = true;
    tenantFront(slug)
      .then((f) => {
        if (!live) return;
        if (!f) {
          setResolved(true);
          setError(t('login.unknownWorkspace', { defaultValue: 'No workspace at that address.' }));
          return;
        }
        setFront(f);
        setResolved(true);
        /*
         * The colours are painted by the route — see `store/tenant.ts`.
         *
         * This is still called so the brand lands in the same frame the name does, rather than
         * a frame later. It is the same function with the same argument, so the two cannot
         * disagree; what changed is that this is no longer the only thing that would paint,
         * and no longer the thing that decides when to stop.
         */
        applyTenantBranding(f.branding);
      })
      .catch(() => {
        if (!live) return;
        setResolved(true);
        setError(t('login.unknownWorkspace', { defaultValue: 'No workspace at that address.' }));
      });
    return () => {
      live = false;
    };
  }, [slug, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await authApi.login(email, password, slug);
      setSession(token, user);
      navigate(homeForRole(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  // A tenant's own accounts, verified by the API before it would name them. Never anyone else's.
  const profiles = front?.demoLogins ?? [];
  const title = front?.name ?? t('login.workspace', { defaultValue: 'Workspace' });

  /*
   * Nothing until we know whose door this is.
   *
   * Rendering the form first and the identity a moment later is what produced a frame of one
   * tenant's name over another tenant's colours. A held frame is a fraction of a second; a
   * wrong one is a bug somebody reports.
   */
  if (slug && !resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="login-resolving">
        <div className="w-9 h-9 rounded-full border-2 border-line border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 60% 40%, rgb(var(--brand) / 0.12) 0%, rgb(var(--canvas)) 60%)",
      }}
    >
      <div className="w-full max-w-[1000px]">
        <div className="flex flex-col-reverse md:flex-row bg-surface rounded-[28px] overflow-hidden shadow-pop min-h-[520px]">
          <div
            className="relative flex-1 flex flex-col items-center justify-center gap-4 p-10 text-white overflow-hidden"
            style={{
              background:
                "linear-gradient(145deg, rgb(var(--brand-700)) 0%, rgb(var(--brand)) 60%, rgb(var(--secondary)) 100%)",
            }}
          >
            <div
              className="w-[110px] h-[110px] rounded-full bg-white/12 border border-white/25 backdrop-blur flex items-center justify-center z-10 overflow-hidden"
              data-testid="tenant-brand-mark"
              style={front ? { backgroundColor: front.branding.primaryColor } : undefined}
            >
              {front?.branding.logoUrl ? (
                <img src={front.branding.logoUrl} alt="" className="w-full h-full object-contain p-4" />
              ) : front ? (
                <span className="text-3xl font-extrabold text-white">
                  {(front.branding.logoText || front.name).slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <PackageOpen size={54} className="text-white" />
              )}
            </div>
            <h1 className="text-3xl font-extrabold z-10" data-testid="tenant-brand-name">{title}</h1>
            {front?.nameAr && (
              <p className="text-lg text-white/80 z-10" dir="rtl">
                {front.nameAr}
              </p>
            )}
            {!front && (
              <p className="text-sm text-white/75 text-center z-10 max-w-xs">
                Agent-operated multi-engine Web POS — storage, mobility, lagoon,
                dining & experiences from one workspace.
              </p>
            )}
            <div
              className="absolute -top-16 -end-16 w-72 h-72 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
              }}
            />
          </div>

          <div className="flex-1 flex items-center justify-center p-8 sm:p-12">
            <form
              onSubmit={submit}
              className="w-full max-w-[340px]"
              data-testid="login-form"
            >
              <h2 className="text-2xl font-extrabold text-navy mb-2">{t('login.welcome')}</h2>
              <p className="text-sm text-muted mb-8">{t('login.subtitle')}</p>

              <label className="lf-label">{t('login.email')}</label>
              <div className="relative mb-4">
                <Mail
                  size={17}
                  className="absolute start-4 top-1/2 -translate-y-1/2 text-muted"
                />
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
                    type={show ? "text" : "password"}
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
                {loading ? t('login.signingIn') : t('login.signIn')}
              </button>

              <Link
                to="/versions"
                className="mt-4 flex items-center justify-between gap-3 rounded-xl2 border border-line hover:border-brand bg-canvas hover:bg-brand/5 px-4 h-12 no-underline transition-colors group"
                data-testid="login-versions"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <Rocket size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy truncate">{t('login.whatsNew')}</span>
                    <span className="block text-[11px] text-muted truncate">{t('login.whatsNewHint')}</span>
                  </span>
                </span>
                <ArrowRight size={16} className="text-muted group-hover:text-brand shrink-0 rtl:rotate-180" />
              </Link>

              {profiles.length > 0 && (
              <div className="mt-6 pt-5 border-t border-line" data-testid="login-demo-accounts">
                <p className="text-[11px] uppercase tracking-wide text-muted font-bold mb-2">{t('login.demoAccounts')}</p>
                <div className="flex flex-col gap-1.5">
                  {profiles.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      data-testid={`demo-${d.email}`}
                      onClick={() => {
                        setEmail(d.email);
                        setPassword(d.password);
                      }}
                      className="text-start text-xs px-3 py-2 rounded-lg bg-canvas hover:bg-navy-50 border border-line flex items-center justify-between"
                    >
                      <span className="font-semibold text-navy">{d.label}</span>
                      <span className="text-muted">{d.email}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted mt-2">
                  {[...new Set(profiles.map((d) => d.password))].join(' · ')}
                </p>
              </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
