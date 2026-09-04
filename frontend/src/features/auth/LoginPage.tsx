import { useState } from "react";
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail, PackageOpen, Rocket } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { homeForRole } from "@/permissions/permissions";

const DEMO = [
  {
    label: "CEO / tenant admin",
    email: "admin.wayz@lockerflow.demo",
    password: "Admin@123",
  },
  {
    label: "Project manager",
    email: "projects.wayz@lockerflow.demo",
    password: "Project@123",
  },
  {
    label: "Manager · Shop & Drop + Mobility",
    email: "manager.wayz@lockerflow.demo",
    password: "Manager@123",
  },
  {
    label: "Manager · Lagoon",
    email: "lagoon.manager.wayz@lockerflow.demo",
    password: "Manager@123",
  },
  {
    label: "Supervisor · Shop & Drop + Mobility",
    email: "supervisor.wayz@lockerflow.demo",
    password: "Super@123",
  },
  {
    label: "Supervisor · Lagoon",
    email: "lagoon.supervisor.wayz@lockerflow.demo",
    password: "Super@123",
  },
  {
    label: "Accountant",
    email: "accountant.wayz@lockerflow.demo",
    password: "Account@123",
  },
  {
    label: "HR & expenses",
    email: "hr.wayz@lockerflow.demo",
    password: "People@123",
  },
  {
    label: "Kiosk agent · Iran (Shop & Drop)",
    email: "agent.wayz@lockerflow.demo",
    password: "Agent@123",
  },
  {
    label: "Kiosk agent · Morocco (Shop & Drop)",
    email: "agent.morocco.wayz@lockerflow.demo",
    password: "Agent@123",
  },
  {
    label: "Kiosk agent · Gate 1 (Mobility)",
    email: "agent.gate1.wayz@lockerflow.demo",
    password: "Agent@123",
  },
  {
    label: "Kiosk agent · Egypt (Lagoon)",
    email: "agent.egypt.wayz@lockerflow.demo",
    password: "Agent@123",
  },
  {
    label: "Kiosk agent · Mountain jetty (Lagoon)",
    email: "welcome.wayz@lockerflow.demo",
    password: "Lagoon@123",
  },
  {
    label: "Chief captain · France jetty",
    email: "captain.wayz@lockerflow.demo",
    password: "Lagoon@123",
  },
  {
    label: "Courier · Bilal",
    email: "courier.wayz@lockerflow.demo",
    password: "Courier@123",
  },
  {
    label: "Courier · Khalid",
    email: "courier2.wayz@lockerflow.demo",
    password: "Courier@123",
  },
];

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await authApi.login(email, password);
      setSession(token, user);
      navigate(homeForRole(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

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
            <div className="w-[110px] h-[110px] rounded-full bg-white/12 border border-white/25 backdrop-blur flex items-center justify-center z-10">
              <PackageOpen size={54} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold z-10">Wayz</h1>
            <p className="text-sm text-white/75 text-center z-10 max-w-xs">
              Agent-operated multi-engine Web POS — storage, mobility, lagoon,
              dining & experiences from one workspace.
            </p>
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
                  placeholder="agent.wayz@lockerflow.demo"
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

              <div className="mt-6 pt-5 border-t border-line">
                <p className="text-[11px] uppercase tracking-wide text-muted font-bold mb-2">{t('login.demoAccounts')}</p>
                <div className="flex flex-col gap-1.5">
                  {DEMO.map((d) => (
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
                  Admin@123 · Project@123 · Manager@123 · Super@123 · Account@123 · People@123 · Agent@123 · Lagoon@123 · Courier@123
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
