import type { Role } from '@/models';

/**
 * The guided tours, as data.
 *
 * One object per role rather than one component with nine branches inside it — a tour is a
 * list of things to point at and say, which is configuration, and writing it as configuration
 * is what makes adding a role a two-minute change rather than a refactor.
 *
 * `target` is a CSS selector, always a `data-testid` the navigation already carries. Nothing
 * here may break the application if it does not match: a step whose anchor is missing is
 * shown centred instead, because a sidebar entry a company has not enabled is a normal
 * situation and not an error.
 */

export interface TourStep {
  id: string;
  /** Looked up in the `onboarding` namespace as `step.<id>.title` / `.body`. */
  target?: string;
  /** Where the step goes before it is shown, when the thing it points at is elsewhere. */
  route?: string;
  placement?: 'auto' | 'center';
}

export interface Tour {
  key: string;
  steps: TourStep[];
}

/** Every tour ends the same way: where help lives, so nobody is left without a next move. */
const FINISH: TourStep[] = [
  { id: 'assistant', target: '[data-testid="assistant-launcher"]' },
  { id: 'training', target: '[data-testid="nav-training"]' },
  { id: 'done', placement: 'center' },
];

export const TOURS: Record<string, Tour> = {
  agent: {
    key: 'agent',
    steps: [
      { id: 'welcome', placement: 'center' },
      { id: 'agent.dashboard', target: '[data-testid="nav-dashboard"]', route: '/dashboard' },
      { id: 'agent.pos', target: '[data-testid="nav-pos"]' },
      { id: 'agent.operations', target: '[data-testid="nav-operations"]' },
      { id: 'agent.shift', target: '[data-testid="nav-shift"]' },
      ...FINISH,
    ],
  },
  courier: {
    key: 'courier',
    steps: [
      { id: 'welcome', placement: 'center' },
      { id: 'courier.board', target: '[data-testid="nav-courier-board"]', route: '/courier' },
      { id: 'courier.history', target: '[data-testid="nav-courier-history"]' },
      ...FINISH,
    ],
  },
  captain: {
    key: 'captain',
    steps: [
      { id: 'welcome', placement: 'center' },
      {
        id: 'captain.board',
        target: '[data-testid="nav-lagoon-captain"]',
        route: '/lagoon/captain',
      },
      { id: 'captain.voyage', target: '[data-testid="nav-lagoon-voyage"]' },
      ...FINISH,
    ],
  },
  manager: {
    key: 'manager',
    steps: [
      { id: 'welcome', placement: 'center' },
      { id: 'manager.overview', target: '[data-testid="nav-mgr-overview"]', route: '/manager' },
      { id: 'manager.live', target: '[data-testid="nav-mgr-live"]' },
      { id: 'manager.team', target: '[data-testid="nav-mgr-team"]' },
      { id: 'manager.reports', target: '[data-testid="nav-mgr-reports"]' },
      ...FINISH,
    ],
  },
  accountant: {
    key: 'accountant',
    steps: [
      { id: 'welcome', placement: 'center' },
      {
        id: 'accountant.dashboard',
        target: '[data-testid="nav-accounting-dashboard"]',
        route: '/accounting',
      },
      { id: 'accountant.settlement', target: '[data-testid="nav-accounting-reconciliation"]' },
      ...FINISH,
    ],
  },
  hr: {
    key: 'hr',
    steps: [
      { id: 'welcome', placement: 'center' },
      { id: 'hr.costs', target: '[data-testid="nav-hr-overview"]', route: '/hr' },
      { id: 'hr.seasons', target: '[data-testid="nav-hr-seasons"]' },
      ...FINISH,
    ],
  },
  admin: {
    key: 'admin',
    steps: [
      { id: 'welcome', placement: 'center' },
      { id: 'admin.overview', target: '[data-testid="nav-admin-overview"]', route: '/admin' },
      { id: 'admin.company', target: '[data-testid="nav-admin-company"]' },
      { id: 'admin.team', target: '[data-testid="nav-admin-team"]' },
      ...FINISH,
    ],
  },
};

/**
 * Which tour a role gets.
 *
 * Mirrors the server's `tourKeyFor`. The two are kept in step deliberately: the server owns
 * *whether it has been completed*, the browser owns *what the steps are*, and they agree on
 * the key that joins them.
 */
const TOUR_BY_ROLE: Record<Role, string> = {
  AGENT: 'agent',
  CHIEF_CAPTAIN: 'captain',
  DELIVERY_AGENT: 'courier',
  SUPERVISOR: 'manager',
  MANAGER: 'manager',
  PROJECT_MANAGER: 'manager',
  HR: 'hr',
  ACCOUNTANT: 'accountant',
  TENANT_ADMIN: 'admin',
};

export const tourFor = (role: Role | undefined): Tour | null =>
  role ? (TOURS[TOUR_BY_ROLE[role]] ?? null) : null;
