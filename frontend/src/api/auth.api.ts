import { http, unwrap } from './client';
import type { Me, Role } from './types';

export interface Invitation {
  email: string;
  fullName: string;
  role: Role;
  roleLabel: string;
  tenantName: string;
  branding: Record<string, string> | null;
  expiresAt: string;
}

/**
 * What a tenant's own sign-in page knows about it before anybody has signed in.
 *
 * Its name and its colours, so the page wears the right brand from the first paint rather
 * than flashing the platform's default and then correcting itself. The demo accounts come
 * from that tenant's own database and are empty unless the deployment says it is a demo.
 */
export interface WorkspaceSummary {
  slug: string;
  name: string;
  nameAr: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoUrl: string | null;
    logoText: string;
  };
}

export interface TenantFront {
  slug: string;
  name: string;
  nameAr: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoUrl: string | null;
    logoText: string;
  };
  locale: 'en' | 'ar';
  secondaryLocale: 'en' | 'ar';
  demoLogins: { label: string; email: string; password: string; role: Role }[];
}

/** A demonstration account offered on the neutral sign-in page. */
export interface DemoProfile {
  label: string;
  email: string;
  password: string;
  role: Role;
}

/** One organisation's demonstration accounts, as the sign-in page groups them. */
export interface DemoOrganisation {
  id: string;
  name: string;
  branding: { primaryColor?: string; secondaryColor?: string; logoText?: string; logoUrl?: string };
  activities: string[];
  logins: DemoProfile[];
}

/**
 * What signing in produces.
 *
 * Two shapes, because there are two kinds of person: somebody who works at one of the
 * companies gets a `user`, and whoever runs the platform gets a `platform`. Exactly one is
 * present, and which one decides where the door leads.
 */
export type SignInResult =
  | { token: string; user: Me; platform?: undefined }
  | { token: string; platform: { id: string; email: string; name: string }; user?: undefined };

export const authApi = {
  logout: () => unwrap<{ ok: boolean }>(http.post('/auth/logout', {})),
  /**
   * Signs in at the neutral door.
   *
   * `tenant` is normally absent: the account decides which organisation the session belongs
   * to. It exists for the one case where an address belongs to two organisations and somebody
   * has to say which.
   */
  login: (email: string, password: string, tenant?: string) =>
    unwrap<SignInResult>(
      http.post('/auth/login', { email, password, ...(tenant ? { tenant } : {}) })
    ),
  /**
   * The demonstration accounts to offer, grouped by organisation.
   *
   * Empty on a real deployment — being able to ask a server who works where is enumeration.
   */
  demoLogins: () => unwrap<{ organisations: DemoOrganisation[] }>(http.get('/public/demo-logins')),
  me: () => unwrap<Me>(http.get('/auth/me')),
  invitation: (token: string) => unwrap<Invitation>(http.get(`/auth/invitation/${token}`)),
  acceptInvitation: (token: string, password: string, confirmPassword: string) =>
    unwrap<{ token: string; user: Me }>(
      http.post(`/auth/invitation/${token}`, { password, confirmPassword })
    ),
};
