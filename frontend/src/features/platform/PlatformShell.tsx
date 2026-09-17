import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  ChartNoAxesColumn,
  LayoutGrid,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { clsx } from 'clsx';

import { useAuthStore } from '@/store/auth';

/**
 * The frame every platform screen sits in.
 *
 * ## Why this is not the tenant chrome
 *
 * The employee shell exists to put somebody *inside* a company: it paints that company's
 * colours, names the station they are standing at, and narrows its navigation to the
 * activities their organisation has adopted. None of that is true here. A platform
 * administrator belongs to no company, stands at no station, and needs to see every activity
 * whether anybody adopted it or not.
 *
 * So the console is deliberately plain — the platform's own palette, four destinations, and
 * nothing that implies a company. Looking like one of the tenants would be a lie about what
 * you are looking at.
 *
 * The layout vocabulary is the same as the rest of the product, so it reads as one system:
 * same cards, same tables, same type scale, same theme toggle.
 */

const NAV = [
  {
    to: '/platform',
    end: true,
    icon: ChartNoAxesColumn,
    label: 'Overview',
    testId: 'nav-platform-overview',
  },
  {
    to: '/platform/organisations',
    icon: Building2,
    label: 'Organisations',
    testId: 'nav-platform-orgs',
  },
  { to: '/platform/reports', icon: LayoutGrid, label: 'Reports', testId: 'nav-platform-reports' },
  {
    to: '/platform/knowledge',
    icon: BookOpen,
    label: 'Knowledge',
    testId: 'nav-platform-knowledge',
  },
];

export function PlatformShell() {
  const platform = useAuthStore((s) => s.platform);
  const logout = useAuthStore((s) => s.logout);
  const theme = useAuthStore((s) => s.theme);
  const toggleTheme = useAuthStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  /* An employee who types /platform is not refused rudely — they are sent back to their door. */
  if (!platform) return <Navigate to="/login" replace />;

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-dk-bg" data-testid="platform-shell">
      <header className="border-b border-line bg-canvas dark:bg-dk-bg dark:border-dk-line">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white text-[13px] font-bold">
              LF
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-navy dark:text-dk-texthi">
                LockerFlow
              </div>
              <div className="text-[11px] text-muted">Platform console</div>
            </div>
          </div>

          <nav className="ms-4 flex items-center gap-1" aria-label="Platform sections">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-testid={item.testId}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition-colors',
                    isActive
                      ? 'bg-brand/10 text-brand'
                      : 'text-muted hover:bg-canvas dark:hover:bg-dk-elevated hover:text-navy dark:hover:text-dk-texthi'
                  )
                }
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
              data-testid="platform-theme"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-canvas dark:hover:bg-dk-elevated hover:text-navy dark:hover:text-dk-texthi"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            <div className="hidden text-end leading-tight sm:block">
              <div
                className="text-[12px] font-medium text-navy dark:text-dk-texthi"
                data-testid="platform-who"
              >
                {platform.name}
              </div>
              <div className="text-[11px] text-muted">{platform.email}</div>
            </div>

            <button
              type="button"
              onClick={signOut}
              data-testid="platform-signout"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] text-muted hover:bg-canvas dark:hover:bg-dk-elevated hover:text-navy dark:hover:text-dk-texthi"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
