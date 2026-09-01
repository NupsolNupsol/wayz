# IMPLEMENTATION_PLAN.md — LockerFlow Agent POS

## Stack
React 18 + TypeScript (strict) + Vite 5 (port **5175**, strictPort) + Tailwind 3 + React Router 6 +
Zustand (typed stores, persisted) + lucide-react (icons) + qrcode.react + Playwright + ESLint.
No backend. Mock services = typed async functions with simulated latency.

## Directory layout (`src/`)
```
app/          App root, providers, router mount
assets/       logo, static
components/    ui primitives (Button, Card, Badge, Table, Modal, Drawer, Toast, Barcode, QrTag, Field, Stepper, Timer, EmptyState, StatCard)
config/        appConfig, feature flags, engine registry, policy proposals
data/          seed data (tenants, sites, stations, users, catalogue, asset types/units, customers, demo transactions)
features/      one folder per domain: auth, dashboard, shopdrop, mobility, lagoon, cote, anaam, customers, transactions, payments, receipts, shift, incidents, pos, assets
hooks/         useAuth, useTenantScope, usePermissions, useToast, useNow
layouts/       AppShell (sidebar+header+content), AuthLayout
mocks/         mock service impls (delay, id gen)
models/        domain types (Tenant, User, Role, Customer, engines, Order, Booking, Payment, StorageSession, BagItem, AssetUnit, Incident, Shift, ...)
permissions/   Role model, permission map, guards
routes/        route table, ProtectedRoute, RoleRoute
services/      service interfaces + wiring to mocks (catalogue, checkout, assets, operations, customers, shift, incidents)
state/         zustand stores (session, cart, operations, demoData)
styles/        globals.css, tokens.css, components.css
tests/         playwright specs + fixtures
utils/         id, money, time, barcode, packing algorithm, format
```

## Phases
1. **Foundation** — scaffold, config, tokens, models, seed data, mock services, stores, permissions, router, AppShell.
2. **Shell (Nupsol-identical)** — Login, Sidebar (nav groups, active state, collapse), Header (welcome, search, notifications, user menu, tenant/station context, connectivity, theme), page container, breadcrumbs.
3. **Agent foundation** — Dashboard (tenant/station scoped stats + quick actions + recent), Shift (start/close, blind count, variance→reconciling), Customers (list/search/create/detail), Transactions (history), Payments, Receipts (printable), Incidents, Profile (context + Reset Demo).
4. **Shop & Drop (deepest)** — New transaction wizard: customer → bags (1 BagItem each) → capacity/PackingPlan → billing model quote → ResourceHold → OTP → payment → AssetReservation (specific unit) → labels/print → scan compartment + scan bags → Confirm Storage (timer) → active session tracking → retrieval (search + scan-out + missing/wrong bag) → handover + chargeableEnd → final receipt → release compartment. Reassignment w/ reason. Incidents.
5. **Other engines** — Reusable rental engine (mobility ×7: select→customer→availability→unit assign→condition→payment→confirm handover→active→return→complete, deposit lines, PROPOSED policy chips). Lagoon (activity/slot/visitors/boat/captain→payment→check-in→trip start→return). COTE (menu/table/cart→payment→KDS prep→served). Ana'am (experience/slot/visitor/animal+trainer→readiness→start→complete→rest).
6. **POS** — unified engine-selection + product-grid + cart split-view; feeds engine flows.
7. **Quality** — responsive (1440/1280/1024/768), a11y, empty/loading/error states, Playwright suite (26 cases), lint, build, fix.

## Multi-tenant & roles
- `Role = 'AGENT' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | ...` (full union kept for extensibility) but only AGENT + minimal MANAGER active.
- Session store holds `{user, tenantId, siteId, stationId, engineIds, shift}`. All service reads filter by tenant/station. `useTenantScope` enforces.
- Permissions map route+action → allowed roles. `ProtectedRoute` + nav filtering. Manager lands on stub page.

## Timers
`useNow` ticks each second; sessions store `storageStartedAt/expectedEndAt`. Payment sets Booking CONFIRMED only. Confirm Storage sets timestamps. Demo durations short (minutes) + a "demo fast-forward" affordance for retrieval/overtime.

## Testing IDs
Every interactive control gets a stable `data-testid` for Playwright. Screenshots/traces → `test-artifacts/`.
