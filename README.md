# LockerFlow Platform

An **agent-operated, multi-engine Web POS**. Two independent apps under one folder:

```
lockerflow-platform/
  backend/    Express + MongoDB + Redis + Docker — config-driven workflow engine
  frontend/   React + TypeScript + Tailwind + TanStack Query + axios (Vite)
```

They are **not a monorepo** — each ships and deploys on its own. The frontend talks to the
backend over HTTP (`/api`, proxied in dev).

## 1) Run the backend (Docker: Mongo + Redis + API)

```bash
cd lockerflow-platform/backend
docker compose up -d --build
# API → http://localhost:4000  (auto-seeds WAYZ + WIQAR on first boot)
curl http://localhost:4000/api/health
```

## 2) Run the frontend

```bash
cd lockerflow-platform/frontend
npm install
npm run dev
# App → http://localhost:5175   (Vite proxies /api → http://localhost:4000)
```

Open **http://localhost:5175** and log in.

## Demo credentials

| Role | Email | Password |
|---|---|---|
| **CEO / tenant admin** | `admin.wayz@lockerflow.demo` | `Admin@123` |
| Project manager | `projects.wayz@lockerflow.demo` | `Project@123` |
| Activity manager · Shop & Drop + Mobility | `manager.wayz@lockerflow.demo` | `Manager@123` |
| Supervisor · Shop & Drop + Mobility | `supervisor.wayz@lockerflow.demo` | `Super@123` |
| **Kiosk agent** · Iran (Shop & Drop) | `agent.wayz@lockerflow.demo` | `Agent@123` |
| Kiosk agent · Gate 1 (Mobility) | `agent.gate1.wayz@lockerflow.demo` | `Agent@123` |
| Kiosk agent · Mountain jetty (Lagoon) | `welcome.wayz@lockerflow.demo` | `Lagoon@123` |
| Chief captain · France jetty | `captain.wayz@lockerflow.demo` | `Lagoon@123` |
| Delivery agent | `courier.wayz@lockerflow.demo` | `Courier@123` |
| HR & expenses | `hr.wayz@lockerflow.demo` | `People@123` |
| Accountant | `accountant.wayz@lockerflow.demo` | `Account@123` |

Every role answers for one of three things: **one desk**, **named activities**, or **the whole
tenant**. A kiosk agent sees one kiosk of one activity — sidebar, catalogue, bookings, till and
dashboard all stop there. There is no separate cashier: the agent who serves the customer takes
their money, and the printed invoice names them. The demo database carries WAYZ alone; the
isolation tests seed a second tenant of their own.

Every role and what it is for: [ROLES.md](ROLES.md). The till at the desk: [TILL.md](TILL.md).
How the client's requirements map to what is built, section by section:
[WAYZ_COMPLIANCE.md](WAYZ_COMPLIANCE.md). The finance roles in depth: [HR.md](HR.md) and
[ACCOUNTANT.md](ACCOUNTANT.md). The card transaction feed, the commission and the reconciliation,
field by field: [TRANSACTIONS.md](TRANSACTIONS.md). The estate — asset kinds, individual assets,
sale units, penalties and QR codes: [ASSETS.md](ASSETS.md). English and Arabic, and what is
deliberately left untranslated: [LANGUAGES.md](LANGUAGES.md). The kiosk agent's handheld and
tablet app: [mobile/AGENT_APP.md](mobile/AGENT_APP.md).

WAYZ themes to the platform primary **#2596be**; WIQAR re-skins to violet **#7c3aed** —
proving the same build renders each company's identity (branding comes from `/api/auth/me`).

## State management (frontend)

- **TanStack Query (React Query)** — all server state (fetching, caching, mutations, invalidation).
- **Zustand** — small client store for the auth token, theme and connectivity flag (persisted).
- **axios** — the transport, isolated in `src/api/` (one module per domain); UI never imports axios.

## Theming / reselling

All brand colours + font are CSS variables in `frontend/src/styles/globals.css` consumed by
`tailwind.config.js`. Change those defaults to re-skin the whole platform; at runtime the
tenant's `branding` overrides them. Icons are **lucide** (no emojis).

## Seeding a deployed server

The seed lives in **`backend/src/seed/seed.ts`** and runs on boot when `AUTO_SEED=true`
(set in `backend/docker-compose.yml`). It is idempotent per database: `seedIfEmpty()` does
nothing when the tenants already exist.

To reseed a server from scratch:

```bash
docker compose exec -T mongo mongosh lockerflow --quiet --eval "db.dropDatabase()"
docker compose restart api          # AUTO_SEED rebuilds everything on boot
docker compose logs api | grep "Seed complete"
```

It creates the WAYZ tenant, the full cast across every role, Boulevard World and Winter
Wonderland with their desks — Shop & Drop counters, vehicle gates and lagoon jetties — the
client's own catalogue and penalty schedule, the boats at the quantities they counted, 90 days of
payments, card transactions with their commission entries, a season with its employee charges, a
set of operating costs, live notifications and a manual sale waiting for approval — so every
workspace has something real to show on first login.

## Tests

Start the Docker stack, then:

- **API — `cd backend && npm test`.** 114 checks over the live API in two passes: `roles.api.mjs`
  (every role, the till, desk and activity scoping, staffing rules, the operating rules,
  notifications, manual sales, reporting and the invoice) and `rules.api.mjs` (section 8.1 of the
  client's brief driven end to end). Both are idempotent — they hand back every asset they borrow.
- **Browser — `cd frontend && npm run test:e2e`.** 145 Playwright specs against the built app.
  The suite reseeds the database first, so every assertion stands on a known fixture: login and
  theming, the full Shop & Drop journey, the engines, the nav, RBAC across every role, the till
  at the desk, desks per activity, the operating rules, notifications, manual sales, the printed
  invoice in both languages, delivery handover, tenant admin, HR, and the accountant's VAT,
  Zakat, exports, commissions and reconciliation.

The config-driven engine lives in `workflow/` — adding an activity is one workflow file plus its
validator and operator. How the client's requirements map to what is built:
[WAYZ_COMPLIANCE.md](WAYZ_COMPLIANCE.md).
