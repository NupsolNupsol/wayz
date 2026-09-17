import { createContext, useContext, useEffect, useRef } from 'react';
import type { PageContextPayload } from '@/api/learning.api';

/**
 * How a screen introduces itself to the assistant.
 *
 * The design constraint is what a page may *not* say. Dumping the DOM, or the props of
 * whatever component is mounted, would ship a customer's name, phone number and payment
 * detail to a third-party model on every question — so a page contributes a small, named,
 * declared set of fields and nothing else:
 *
 *   - a stable key, e.g. `agent.delivery.details`, which knowledge documents can be pinned to
 *   - the module it belongs to, matching the knowledge base's own vocabulary
 *   - what the screen is called, in the employee's language
 *   - what kind of thing is on it and what state that thing is in — a status, never a record
 *   - what the user is able to do here
 *
 * A page that registers nothing still works: the assistant answers generally instead of
 * contextually, which is the right degradation.
 */

export interface PageContextValue extends PageContextPayload {
  pageKey: string;
}

interface Registry {
  current: PageContextValue | null;
  set: (value: PageContextValue | null) => void;
  read: () => PageContextValue | null;
}

export const PageContextRegistry = createContext<Registry | null>(null);

export function usePageContextRegistry(): Registry | null {
  return useContext(PageContextRegistry);
}

/**
 * Declares the current page to the assistant for as long as this component is mounted.
 *
 * `deps` decides when a changing value is republished — the entity status on a delivery
 * screen changes as the agent works, and the assistant should be answering about the state
 * in front of them rather than the one the page opened with.
 */
export function usePageContext(value: PageContextValue, deps: unknown[] = []): void {
  const registry = usePageContextRegistry();
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (!registry) return;
    registry.set(latest.current);
    return () => registry.set(null);
    // The caller owns the dependency list; `value` is read through a ref so an inline object
    // literal at the call site does not republish on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, ...deps]);
}

/**
 * The page keys used across the workspace.
 *
 * Written down in one place so a knowledge document can be pinned to a screen by a key that
 * is checked rather than by a string somebody remembered. Free keys still work — this is the
 * list the Super Admin form offers, not a closed set.
 */
export const PAGE_KEYS = {
  dashboard: 'agent.dashboard',
  pos: 'agent.pos',
  shopDrop: 'agent.shopdrop',
  mobility: 'agent.mobility',
  lagoon: 'agent.lagoon',
  myGate: 'agent.gate',
  operations: 'agent.operations',
  deliveries: 'agent.deliveries',
  bookings: 'agent.bookings.list',
  bookingDetail: 'agent.booking.details',
  customers: 'agent.customers.list',
  customerDetail: 'agent.customer.details',
  incidents: 'agent.incidents',
  shift: 'agent.shift',
  assets: 'shared.assets',
  courierBoard: 'courier.board',
  courierTask: 'courier.task',
  tillOverview: 'till.overview',
  tillQueue: 'till.queue',
  tillDrawer: 'till.drawer',
  managerOverview: 'manager.dashboard',
  managerLive: 'manager.live',
  managerTeam: 'manager.team',
  managerReports: 'manager.reports',
  accounting: 'accounting.dashboard',
  hrCosts: 'hr.costs',
  adminOverview: 'admin.overview',
  training: 'shared.training',
} as const;

export type PageKey = (typeof PAGE_KEYS)[keyof typeof PAGE_KEYS];

/**
 * `/bookings/bkg_9f2a1` -> `/bookings/:id`.
 *
 * The assistant needs to know *which screen*, never *which record*. Sending the identifier
 * would put a customer's booking reference into a prompt for no benefit at all: no knowledge
 * document is about one booking.
 */
export function anonymiseRoute(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) =>
      segment && /\d/.test(segment) && /^[A-Za-z0-9_-]{6,}$/.test(segment) ? ':id' : segment
    )
    .join('/');
}
