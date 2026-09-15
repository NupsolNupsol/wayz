# WAYZ Platform — Complete Guide

> Everything needed to understand, run, extend, and answer questions about the platform:
> architecture, the workflow engine, tech choices (and *why* each), theming, and a manager FAQ.

---

## 1. What it is

An **agent-operated, multi-engine Web POS**. A single employee ("Agent") runs the entire
customer journey — booking, payment, labelling, physical asset assignment, timers,
retrieval/handover — for **many different business engines** (bag storage, mobility rentals,
lagoon boat trips, restaurant, animal experiences). The same product is **re-skinnable per
company** (colours + fonts) and **extensible per engine** without rewriting the core.

There is **no customer app** — every action starts from the authenticated agent workspace.
Two roles today: **AGENT** (full workflow) and **MANAGER** (authenticates; dashboard is an
intentional stub until specified). The role model is extensible.

---

## 2. Repository layout

```
lockerflow-platform/
  workflow/    @wayz/workflow — the state machines, validators and operators. Built with tsc.
  backend/     Express + MongoDB + Redis + Docker (TypeScript). The API. Consumes workflow/dist.
  frontend/    React + TypeScript + Vite + Tailwind. The agent UI.
  README.md            quick run instructions
  PLATFORM_GUIDE.md    this document
```

**Three independent packages**, each with its own `package.json` and build. The frontend talks
to the backend only over HTTP (`/api`); the backend consumes the *compiled* workflow package.

> **Build order matters:** `workflow` must be built before the backend runs, because the
> backend imports `../workflow/dist`. `cd workflow && npm run build`. The Docker image does
> this for you (the API build context is the platform root — see §5.1).

---

## 3. Tech stack — what and **why**

### Backend
| Tech | Why we use it |
|---|---|
| **Node + Express** | Small, ubiquitous HTTP framework; thin controllers, easy middleware. |
| **TypeScript** (strict) | Compile-time safety for the domain + the typed workflow engine. |
| **MongoDB + Mongoose** | Document DB fits the **Booking aggregate** (bags, session, custody embedded in one doc → a transition mutates one document atomically-ish). Mongoose gives schemas + validation. |
| **Redis + BullMQ** | Optional reminder queue (overtime sweep). Mirrors the chargeback architecture. Fully optional — the API and tests run without it. |
| **Docker + docker-compose** | One command brings up Mongo + Redis + API, reproducibly. |
| **JWT (jsonwebtoken)** | Stateless auth; the token carries `{ userId, role, tenantId, stationId }`. |
| **bcryptjs** | Password hashing (mock users). |
| **zod** | Runtime validation of env vars and every request body (fail fast, typed). |
| **tsx** | Runs TypeScript directly (dev, prod, Docker) — no separate build artifact. |
| **@playwright/test** | API E2E tests using the `request` fixture on an in-memory Mongo. |
| **mongodb-memory-server** | Spins an ephemeral Mongo for tests — no external DB needed. |

### Frontend
| Tech | Why we use it |
|---|---|
| **React 18 + TypeScript** | Component model + type safety end-to-end. |
| **Vite** | Fast dev server + build; proxies `/api` to the backend in dev. |
| **Tailwind CSS** | Utility-first styling. All brand values are **CSS variables** so the theme is swappable (see §8). |
| **TanStack Query (React Query)** | **Server state**: fetching, caching, background refetch, and mutation → cache invalidation. This is our primary "store" for anything that lives on the backend. |
| **Zustand** | **Client/UI state only**: the auth token, `me`, theme (light/dark), and the online flag. Tiny, persisted to localStorage. |
| **axios** | The HTTP transport, isolated in `src/api/` behind typed endpoint modules. The UI never imports axios directly. |
| **React Router 6** | Routing + route guards. |
| **lucide-react** | Consistent, professional icon set (no emojis). Icons are resolved by name through a small registry. |
| **qrcode.react** | QR codes on receipts/labels. |
| **@playwright/test** | Browser E2E against the live stack. |

**Why React Query *and* Zustand (a common manager question):** they solve different problems.
React Query owns **server** data (it already handles caching, loading/error, refetch, and
invalidation — reimplementing that in a global store is an anti-pattern). Zustand owns the
tiny slice of **client** state that isn't on the server (auth token, theme). axios is just the
wire. This separation keeps components declarative and the data layer testable.

---

## 4. Architecture at a glance

```
Browser (React)
  UI (features/*)  ──uses──▶  React Query hooks (hooks/use*.ts, one file per domain)
                                    │ calls
                                    ▼
                             API modules (api/*.api.ts)  ──axios──▶  HTTP /api
                                                                       │
                                                                       ▼
Backend (Express)  routes/*  ─▶  controllers/*  ─▶  services/*  ─▶  models/*
                   interfaces/*  (shared types)   constants/*  (labels)
   (thin: mw+wire)   (req/res + zod)     (use-cases)      (Mongoose → MongoDB)
                                             │
                                             ▼
                            @wayz/workflow (separate package, PURE)
                            validators (guards) + operators (effects)
```

**Layered separation (backend):** `routes` are **thin** — they only attach middleware and point
to a controller method. `controllers` parse/validate the request (zod), call a service, and shape
the response. `services` hold the use-case logic. `models` are persistence. The state machine is
**not in the backend at all** — it is the `@wayz/workflow` package (§5), which has zero knowledge
of HTTP, Mongo or the backend.

**Request lifecycle example — "Confirm Storage":**
`POST /api/bookings/:id/transition {code:'TO_STORED', payload}` →
`authenticate` + `requireAgent` middleware → `booking.route` validates with zod →
`transitionBooking` loads the Booking → `workflow.service` finds the transition, gathers the
relevant units, runs the engine's **validator** (all bags scanned? unit matches?) then its
**operator** (store bags, start timer, declare `SET_STATUS` on the unit) → persists the returned
snapshot and executes the intents → response `{ booking }` →
React Query invalidates `bookings`/`booking/:id`/`dashboard` → the UI re-renders.

---

## 5. The workflow package (the heart) — `@wayz/workflow`

The engine lives **outside** the backend, as its own built package. Same arrangement as the
chargeback platform: the server imports the compiled `dist/`, and the package itself knows
nothing about Express or Mongo.

### 5.1 Layout

```
workflow/
  shared/
    access.ts     roles (AGENT, CASHIER, MANAGER, …)       ← centralised
    status.ts     every booking / unit / bag status      ← centralised
    types.ts      transition, context, snapshots, intents ← centralised
  bookingWorkflowValidators/       ← the GUARDS, one controller per engine
    controller.shopdrop.validator.controller.ts
    controller.mobility.validator.controller.ts   … (5)
    shared.validators.ts           ← checks reused across engines
  bookingWorkflowOperations/       ← the EFFECTS, one controller per engine
    controller.shopdrop.operation.controller.ts   … (5)
    shared.operations.ts           ← operations reused across engines
  workflow/
    booking.<engine>.workflow.ts   ← transitions + Launch<Engine>Control / Operation
    booking.engines.workflow.ts    ← registry: engine → workflow
    workflow.validators.ts         ← registry: engine → validator
    workflow.operators.ts          ← registry: engine → operator
```

Statuses, types and roles are centralised in one file each. **Guards and effects are not**:
every engine owns its own validator and operator controller, so a tenant can add or change one
engine's rules without touching another's. Checks that genuinely apply to every asset type live
once in `shared.validators.ts` / `shared.operations.ts` and are imported by whichever
controllers need them.

### 5.2 A workflow is data; the two halves are code

```ts
export const shopDropWorkflow: EngineWorkflow = {
  engineKind: 'SHOP_AND_DROP',
  assetKind:  'COMPARTMENT',          // which physical kind this governs
  transitions: [
    { code:'TO_STORED', label:'Confirm storage (start timer)',
      source:[RESERVED], target: ACTIVE, actors: OPS },
    …
  ],
}

export const LaunchShopDropControl   = (code, ctx) => useShopDropValidator(code, ctx)
export const LaunchShopDropOperation = (code, ctx) => useShopDropOperation(code, ctx)
```

Each controller is a `switch (transitionCode)` — the shape the chargeback platform uses.
Validators return `{ errors }`; operators return `{ errors, booking, assetIntents, audits }`.

### 5.3 Dispatch is on the kind of asset

`engineKind` **is** the business type of the asset: `COMPARTMENT`→Shop&Drop,
`VEHICLE`→Mobility, `BOAT`→Lagoon, `TABLE`→COTE, `ANIMAL`→Ana'am. Both lookups exist —
`getWorkflow(engineKind)` and `getWorkflowByAssetKind(kind)` — and `assertRegistryConsistent()`
fails fast if a workflow ever declares a kind that disagrees with the central mapping.

### 5.4 The package is PURE — and that is the point

It cannot read or write a database. A validator receives a plain booking **snapshot**; an
operator returns a **new** snapshot plus *declarative* asset intents:

```ts
{ op:'SET_STATUS', unitId:'unit_L1', status:'OCCUPIED', currentBookingId:'bk-0042' }
```

`backend/src/services/workflow.service.ts` is the adapter: it resolves the workflow, gathers
the units the controllers may reason about, runs validator → operator, then persists the
snapshot and executes the intents. Because nothing was written before the operator returned,
a rejected transition leaves the estate untouched.

**Adding an engine — the manager's key question.** Write three files
(`booking.<engine>.workflow.ts`, its validator controller, its operator controller), add one
line to each of the three registries, rebuild the package. Routes, RBAC, availability,
persistence and the docs page all consume it unchanged. **No backend change at all.**

> ⚠️ **Shop & Drop is the confirmed workflow.** Mobility, Lagoon, COTE and Ana'am are marked
> `⚠️ ASSUMED WORKFLOW` — replace the three files for that engine and nothing else moves.

## 6. Domain model

**Booking is the aggregate root** (`models/booking.model.ts`): it embeds the operational state
so a transition mutates one document — mirroring how a chargeback operation mutates one entity:
- `bags[]` — each a `BagItem` with a **unique barcode** (invariant: 1 bag = 1 BagItem = 1 barcode).
- `session` — kind + timer fields (`startedAt`, `expectedEndAt`, `chargeableEndedAt`).
- `reservation` — the specific unit locked post-payment (Agent Lease).
- `custody[]` — the CUSTOMER→AGENT→LOCKER→… trail.
- `verifications[]` — every identity check run against this booking (§11.1), append-only.
- `packingPlan` — how bags map to compartments.
- `transitionLog[]` — every state change (who/when/why).

Separate collections: `Order` (financial: lines, VAT, deposit, totals, pre-payment `hold`),
`Payment` (ledger), `AssetUnit` (shared physical resource), `Customer`, `Shift`, `Incident`,
`Audit`, `Notification`, plus the org hierarchy `Tenant → Site → Zone → Station`.

**The finance side** adds four more: `Expense` (every cost — supplier invoices, repairs, rent,
payroll and the bank commission), `Season` (the six-month container every project's employee
charges hang off), `CardTransaction` (a card payment as the terminal saw it) and `CommissionRate`
(the contract rate per card scheme, per tenant). Money is stored **VAT-inclusive** and split into
`baseAmount` / `vatAmount` at the point it is taken, so no report ever re-derives it. See
[HR.md](HR.md) and [ACCOUNTANT.md](ACCOUNTANT.md).

**Capacity suggestion (the packing algorithm in action):** in the Shop & Drop wizard the agent
enters each bag's **type, size (W×H×D) and weight**. `POST /api/catalogue/packing-suggestions`
runs the bin-packing algorithm (`domain/packing.ts`) across every compartment size and returns a
**ranked recommendation** (fewest compartments → has availability → tightest capacity). The UI
auto-selects the recommended compartment and lets the agent override. So the algorithm **drives**
the compartment choice from real bag data — it isn't a manual guess.

**Key invariants enforced (traced to the client spec):**
- Capacity **packing ≠ pricing**: multiple bags can share one compartment; one order can need
  several. First-fit-decreasing bin-packing in `domain/packing.ts`.
- **ResourceHold** (pre-payment, by AssetType) vs **AssetReservation** (post-payment, specific
  unit).
- **Payment never starts a timer** — only fulfilment transitions call `startTimer()`
  (`TO_STORED` / `TO_HANDOVER` / `TO_STARTED`).
- **The timer never starts without a complete physical scan** — `TO_STORED` demands the scanned
  compartment to equal the reservation and the scanned barcodes to be an **exact** match for the
  registered bags (§7.1).
- **Custody is never released to an unverified claimant** — `TO_RETRIEVAL` requires a fresh
  identity proof, and consumes it so it cannot authorise a second release (§11.1).
- Retrieval **rejects wrong bags** and **blocks completion** until every bag is scanned out;
  completion **releases** the compartment.

---

## 7. The Shop & Drop workflow (end to end)

`DRAFT` →(pay)→ `CONFIRMED` →(reserve unit)→ `RESERVED` →(**Confirm Storage: timer starts**)→
`ACTIVE` →(**verify identity** → begin retrieval)→ `RETRIEVAL_IN_PROGRESS` →(scan every bag
out, verify)→ `COMPLETED` (unit released). In the UI (`features/shopdrop/ShopDropPage.tsx`)
the intake half is a guided wizard: Customer → Bags → Capacity/Hold → **OTP** + Payment →
Reserve → Scan + Confirm Storage → Done. Retrieval + generic actions live in the
**BookingDetail console** (`features/bookings`), driven by the engine's available transitions.

**There are two OTPs, and they do different jobs.** The one at payment confirms the desk has a
contactable number. The one at **retrieval** is the security control — see §11.1.

### 7.0 Overtime: grace period + whole-hour blocks ⭐

One pure function owns the rule — `backend/src/domain/overtime.ts` — and **every** consumer
reads it: the booking DTO, the public tracking page, the sweeper, the WhatsApp warning, and the
charge raised at completion. Nothing recomputes money anywhere else, so the agent console and
the customer's phone can never disagree.

| Time past `expectedEndAt` | Phase | Charged |
|---|---|---|
| 0 → 5 min | `GRACE` | **nothing** — the grace is genuinely free |
| 5 → 60 min | `OVERTIME` | **1 hour** |
| 60 → 120 min | `OVERTIME` | 2 hours |

Crossing the grace threshold costs a **full hour**, however marginal the overrun; blocks are
then measured from `expectedEndAt`, so the grace is forgiven only if the customer finishes
inside it. `chargeableEndedAt` **freezes** the figures at completion, so a historical booking
reports what it actually incurred rather than a number that keeps growing.

- **Grace** is `session.gracePeriodMin`, defaulting to **5** (was 15).
- **Rate** is `session.overtimeHourlyRate`, **snapshotted from the catalogue at booking time** —
  a later price change must not retroactively alter a running session. Set
  `CatalogueProduct.overtimeHourlyRate` per product (falls back to `basePrice`).
- **`ACTIVE → OVERTIME` flips at the end of grace**, not at `expectedEndAt`. The previous sweep
  flipped at expiry, contradicting the grace period it was meant to honour.
- **The penalty becomes a real balance**: on completion an `Overtime — N × 1h` line is appended
  to the order, totals are recomputed and the order returns to `AWAITING_PAYMENT`. It is *not*
  recorded as a captured `Payment` — that would claim cash we have not collected.

**T-15 WhatsApp warning.** `sweepExpiryWarnings` messages the customer ~15 min before expiry
(`EXPIRY_WARNING_MINUTES`) explaining the grace period, the full-hour rule and their tracking
link. `session.expiryWarningSentAt` is written *before* dispatch, so a slow provider cannot
cause a double-send; delivery failures raise an agent Notification instead of retrying forever.

### 7.1 Physical scan-in — `TO_STORED` ⭐

This is the moment the **billing timer starts** and custody moves **AGENT → LOCKER**, so the
evidence is validated strictly. Three guards run before any effect:

| Guard | Rejects |
|---|---|
| `compartmentMatchesReservation()` | a **missing** compartment scan, or one that isn't the reserved unit |
| `reservedUnitHeldForBooking()` | a unit that vanished, was taken by another booking, is out of service, or whose Agent Lease is already spent |
| `allBagsScanned()` | **missing** bags, **foreign** barcodes (another customer's bag), and **duplicate** scans standing in for an absent bag |

The bag check is an **exact set match**, not a subset. All violations are collected and returned
together (422) so the agent fixes the trolley in one pass. Barcodes are trimmed, so a scanner's
trailing newline isn't mistaken for a different bag.

Then the effects run: `storeBagsAndOccupy()` (bags → `STORED`, unit → `OCCUPIED`, Agent Lease
`CONSUMED`), `startTimer()` (sets `startedAt` / `expectedEndAt` — the billing anchor), and
`addCustody({ from:'AGENT', to:'LOCKER' })`.

**Two design points worth knowing:**

1. **The payload is evidence; the reservation is truth.** `storeBagsAndOccupy` takes the unit from
   `booking.reservation`, never from `payload.scannedUnitId`. The guard has already proved the
   agent scanned that exact unit, so the payload's job is to attest the scan happened — it cannot
   nominate where the bags go. (The old `payload.scannedUnitId ?? …` fallback allowed exactly that.)
2. **The client cannot fabricate the evidence.** Both the wizard and the booking console collect
   scans through the shared `components/StorageScanPanel.tsx`, which emits **only** what was
   scanned. The console previously built the payload from `booking.bags`, which forged a perfect
   scan out of the database and made the whole control decorative. The UI is convenience; the
   guards are the control.

---

### 7.2 Public tracking page + PDF invoice ⭐

**`GET /api/public/tracking/:id`** is the platform's **only** unauthenticated read. It lives in
its own router (`routes/public.route.ts`) so publishing something is always a deliberate act,
never an accident of mounting.

- The booking id is a **capability** (`bk_` + 10 nanoid chars) handed to the customer as a QR.
- The response is built by **allow-list** in `tracking.service.ts`, never by stripping fields —
  a new Booking field cannot silently become public. Deliberately excluded: **bag barcodes**
  (they are the claim token used at retrieval scan-out), customer name/phone, and every
  internal id. A test asserts these never appear in the payload.
- A `DRAFT` returns 404, identically to an unknown id — answering would confirm the id exists.
- Rate-limited to 120 req/min per IP (`middlewares/rateLimit.ts`, in-memory; move to Redis for
  multi-instance).

**Frontend:** `/track/:id` is registered as a **sibling** of the `ProtectedRoute` branch in
`routes/router.tsx`, so it can never inherit an auth guard. `features/tracking/TrackingPage.tsx`
is mobile-first and renders without AppShell: a live countdown (ticking locally via `useNow`,
while every money figure comes from the server), a distinct amber **grace** state, and a loud
red **overtime** state showing the accumulated penalty.

**PDF invoice.** "Download invoice" appears on the Shop & Drop done step and in the booking
console. `features/invoice/InvoiceDocument.tsx` uses `@react-pdf/renderer` primitives, so the
output is a **vector** PDF (selectable text, a few KB) rather than a page screenshot. It carries
the rental metadata, the customer, the charge lines with VAT, the items, the overtime policy in
writing, and a **QR encoding the public tracking URL**.

Two implementation notes worth knowing:
- The ~1 MB renderer is behind a **dynamic import inside the click handler**, so it is a
  separate chunk and never touches the main bundle.
- react-pdf has its own layout engine and cannot mount the app's `QrTag` (an SVG component), so
  `useInvoiceDownload` renders the same `qrcode.react` payload to an offscreen canvas and passes
  a PNG data URI in. Same encoded value, same tag.

## 8. Theming — where to change colours & fonts (re-skin per client)

The brand is **configured in code** and applies **platform-wide for every tenant/user**. This is
the intended model: to sell the product to a new client, **clone the project and change the
colours/font in one place** — the whole platform re-skins.

Everything is a **CSS variable** (RGB triplet, so Tailwind opacity modifiers keep working).

**The one place to change:** `frontend/src/styles/globals.css` → `:root { … }`
```css
--brand: 20 184 166;      /* PRIMARY (#14b8a6). Change this line to re-skin everything. */
--brand-600 / --brand-700 /* darker shades (hover, sidebar depth) */
--secondary: 15 118 110;  /* secondary colour */
--switch: 245 166 35;     /* accent / "switch" colour (toggles, highlights) */
--font: system-ui, …;     /* platform font */
```
`frontend/tailwind.config.js` maps these variables to Tailwind colours (`brand`, `secondary`,
`switchc`, …) and the font. You normally only touch `globals.css`.

Because the colour is a CSS variable everywhere (sidebar, buttons, active states, charts,
login), changing that single block re-skins the entire product. The Profile page shows the live
swatches. **This is deliberately NOT per-tenant** — every tenant/user in a given deployment sees
the same code-configured brand. (The `Tenant.branding` field still exists in the API for a
possible future per-tenant option, but the frontend does not apply it.)

---

## 9. Phone inputs — country prefix

`frontend/src/components/PhoneInput.tsx` renders a **searchable country dial-code selector**
(e.g. `+212` Morocco) next to the number, to avoid formatting mistakes. Country list:
`frontend/src/config/countries.ts` (default Saudi Arabia `+966`). Used in the customer create
forms. The emitted value is `"<dial> <number>"`.

---

## 10. Auth, roles, isolation

- **JWT** login (`POST /api/auth/login`) → token carries role + tenant + station.
- **Middleware**: `authenticate` (verify token), `requireAgent` / `requireRole(...)` (RBAC).
- **Multi-tenant isolation**: every service query is scoped to `tenantId` + `stationId` from the
  token — an agent can never read another tenant's data (covered by tests).
- **RBAC example**: a Manager token calling an agent route gets `403`; shift variance resolution
  is Manager/Tenant-admin only (agents can't self-approve).
- **Seven roles, seven workspaces**: agents run a counter (`/dashboard`) for the activities they
  are assigned to and work the till at their own desk (`/till`), delivery agents carry bags (`/courier`),
  managers administer the operation (`/manager`), the tenant admin owns the company (`/admin`), HR
  records what the business spends (`/hr`) and the accountant reads what it earned and owes
  (`/accounting`). Scope travels on the JWT — `tenantId`, `stationId`, `kioskId` and, for an agent,
  `engineKinds` — so it is never something a client can widen. See [ROLES.md](ROLES.md). `homeForRole()` in
  `permissions/permissions.ts` is the single source of truth for where each role lands, shared by
  the login page, the sidebar brand link and the route guards — a fixed fallback once produced an
  infinite redirect, so there is now exactly one function that answers the question.

## 11. OTP — the two levels of assurance

`backend/src/services/otp.service.ts` generates a 4-digit code and delivers it over **WhatsApp
via Vonage** when `VONAGE_API_KEY` / `_SECRET` / `_WHATSAPP_NUMBER` are set. Without them it runs
in MOCK mode and **returns** the code so the agent UI can display it.

That MOCK degradation is fine for the **pre-payment** check (`VERIFY_PHONE`): the customer is
standing at the desk and the OTP only confirms a working number. It is **not** acceptable when
the code is the thing standing between a stranger and someone's luggage — an agent typing a code
the screen just showed them proves nothing. So `sendOtp` takes `allowMockFallback`:

| Caller | `allowMockFallback` | On provider failure |
|---|---|---|
| Pre-payment `VERIFY_PHONE` | `true` (default) | returns a mock code — flow continues |
| Retrieval challenge (§11.1) | `false` | returns `delivered: 'FAILED'` — **no code is leaked**, the agent must run an audited fallback |

### 11.1 Identity verification before custody release ⭐

**The rule:** the platform never hands over a customer's property (or money) until the person
claiming it is proven to be the owner. Today that gates **Shop & Drop retrieval**; the mechanism
is generic and reusable.

**How it is enforced — in the engine, not in a controller.** `TO_RETRIEVAL` carries the guard
`identityVerified('RETRIEVAL')` and the effect `consumeVerification('RETRIEVAL')`:

```ts
{ code:'TO_RETRIEVAL', source:['ACTIVE','OVERTIME'], target:'RETRIEVAL_IN_PROGRESS',
  guards:  [identityVerified('RETRIEVAL')],
  effects: [consumeVerification('RETRIEVAL'), markUnit('RETRIEVAL_PENDING'), addCustody({…})] }
```

The guard asks only *"is there a fresh, unconsumed proof on this booking?"* — never *how* it was
obtained. That keeps the engine free of provider knowledge and makes the control **one line** to
add to any other transition. The effect **burns** the proof, so one challenge authorises exactly
one release and cannot be replayed. A proof is valid for **30 minutes**.

**The three ranked methods** (`services/verification.service.ts`) — the fallbacks are *audited
escalations*, never bypasses:

| # | Method | When | What it demands |
|---|---|---|---|
| 1 | `WHATSAPP_OTP` | normal | Code sent to the phone stored **on the booking**. The agent cannot nominate a number, and never sees the code. |
| 2 | `ID_DOCUMENT` | provider down / customer without their phone | Document type + number + holder name + a **captured photo**, plus a written **reason**. |
| 3 | `MANAGER_OVERRIDE` | nothing else works (doc 12 §3.2) | A manager authorises **with their own credentials on the agent's device** (step-up auth — the agent's session is untouched). The record is attributed to the *manager*. |

Every one of them appends to `booking.verifications[]` (append-only, like `custody[]`) **and**
writes an `Audit` row. The booking page shows the whole trail, so a reviewer sees at a glance
that the OTP was skipped, by whom, and why.

**Privacy by design:** the ID image is stored in its **own** collection
(`VerificationEvidence`), never in the Booking aggregate — that aggregate is read and re-saved on
every transition, and the image is sensitive PII. The booking keeps only an `evidenceId`, the
document type, the holder name and the **last 4 digits** of the number. The image is served by a
separate guarded endpoint, and every view of it is audited.

**API**
```
POST /api/bookings/:id/verification/send      { purpose } → { delivered, phoneMasked, … }
POST /api/bookings/:id/verification/confirm   { method, … } → booking   (discriminated on method)
GET  /api/bookings/:id/verification/evidence/:evidenceId → the captured image
```
**UI:** `components/IdentityVerification.tsx` (3-tab modal + the read-only trail), opened from the
BookingDetail console. Pressing "Begin retrieval" collects the proof first rather than firing a
transition the guard would reject.

### 11.2 Does every engine need this?

**No — and that is a deliberate call, not an omission.** The control belongs wherever the platform
releases custody of something the customer owns:

| Engine | Needed? | Why |
|---|---|---|
| **Shop & Drop** | ✅ **Yes — implemented** | The bags are the customer's property, held by us. Retrieval is the moment of release. |
| **Mobility** (scooters) | ⚠️ Not at return | Returning the asset *gives us* property — an impostor returning a scooter is not a threat. The exposure is the **deposit refund**: that should demand `identityVerified('DEPOSIT_REFUND')`. The purpose already exists; wire it when the refund transition is built. |
| **Lagoon / Ana'am** | ❌ No | The customer is present for the whole session; nothing of theirs is held and later released. |
| **COTE restaurant** | ❌ No | Pay → serve. No custody, no timer, no release. |

Adding it later is one guard + one effect on the relevant transition — no engine, route or
persistence change.

---

## 11.9 Backend structure

```
src/routes/      thin — middleware + a controller
src/controllers/ zod at the boundary, response shape
src/services/    the use-cases. No type declarations of their own — they import them.
src/domain/      pure rules: tax, commission, overtime, packing, incidents, types
src/interfaces/  every shared type, grouped by relation, one file per group:
                 scope (Scope, ManagerScope, AccountingScope, HrScope, CourierScope,
                 KioskScope), accounting (PeriodFilter, ActivityFigures, VatReturn,
                 ZakatReport, LedgerRow), transactions, hr, staff, booking, delivery,
                 till, notifications, manual sales, messaging, verification, catalogue, tracking.
                 index.ts re-exports them all.
src/constants/   the label maps that are presentation, not rules — ACTIVITY_LABELS,
                 SCHEME_LABELS, ROLE_LABELS, INCIDENT_LABELS
src/models/      Mongoose schemas
src/middlewares/ auth, rate limiting, error handling
```

**Why interfaces live apart from services.** A type declared inside `accounting.service.ts`
forces every consumer — controllers, other services, tests — to import *the service* just to
name a shape, which drags the whole module (and its dependencies) along and invites import
cycles. With the types in `src/interfaces/`, a controller imports the shape without importing
the behaviour, and a service can share a type with another service without either depending on
the other. The same reasoning puts the label maps in `src/constants/`: `SCHEME_LABELS` is
presentation, and `domain/` is supposed to hold rules.

---

## 12. Frontend structure

```
src/api/         axios client + one typed module per domain (auth, catalogue, booking, …)
src/hooks/       React Query hooks, one file per domain — useBookings, useCashier,
                 useDeliveries, useKiosk, useManager, useAccounting, useHr,
                 useCommissions, useTenantAdmin… plus queryKeys.ts (the one key
                 registry), pollIntervals.ts and useNow (timers). index.ts re-exports
                 them, so a feature imports from '@/hooks'.
src/store/       Zustand auth store + theme applier
src/lib/         the QueryClient
src/components/  presentational + shared (ui, Modal, Drawer, Charts, PhoneInput, OtpBox, …)
src/layouts/     Sidebar, Header, AppShell
src/features/    one folder per screen (auth, dashboard, shopdrop, engine, bookings, …)
src/config/      navigation, engine metadata, chart colours, countries
src/routes/      router + ProtectedRoute
src/styles/      globals.css (design tokens + a few unavoidable globals)
```
`ProtectedRoute` requires a token, backfills `me`, and routes managers to `/manager`.

---

## 13. Senior practices employed

- **Separation of concerns / layering** (routes → services → domain → models; api → hooks → UI).
- **Open/Closed + DRY**: new engines are additive config; guards/effects are reused.
- **Single source of truth** per concern: React Query for server state, Zustand for UI state.
- **Isolated transport**: axios only in `src/api/`; the rest imports typed functions.
- **Validation at the boundary**: zod on env + every request body.
- **Uniform error envelope** `{ success, statusCode, message, errors }` + central handler.
- **Typed everywhere** (strict TS on both sides); the workflow definitions are fully typed.
- **Aggregate design** so a state change is one document mutation.
- **Refunds** are a first-class action, not a back-office correction: the agent refunds from the
  booking, the amount defaults to everything the customer paid and can be lowered, the reason is
  mandatory, and the result lands on the booking, in the payment ledger, in the VAT return and in
  the audit trail.
- **One search box** over the whole workspace: a booking reference, a customer, a phone number —
  or, for the accountant, a payment or a terminal transaction. Narrowed exactly like the screens
  are, so an agent cannot find another activity's booking through it.
- **Auditability**: every state-changing request is recorded. The domain writes the interesting
  entries itself (overrides, reassignments, refunds, payroll runs); anything it does not describe is
  caught by `middlewares/audit.ts`, which records the actor, the action, the entity and its
  reference once the response succeeds — never for a read, never for a refusal, and never twice for
  the same request.
- **Tested**: 200 backend specs + the browser suite against the live stack; lint + typecheck clean.

## 14. Testing

- Backend: `cd backend && npm test` — 149 Playwright tests on in-memory Mongo. Mostly API-level
  (auth/isolation, full Shop & Drop lifecycle, all engines, RBAC, guarded state machine, the
  **scan-in guard matrix**, the retrieval identity gate + both fallbacks). `guards.spec.ts` runs
  at the **domain** level instead: it calls the guards directly with a stubbed `AssetOps` to cover
  the concurrency branches (unit stolen / out of service) that a sequential HTTP test cannot
  stage — which is precisely what the port abstraction is for. `overtime.spec.ts` is likewise a
  domain spec: it probes every minute of the grace/penalty timeline without waiting in real
  time. No Docker needed.
  `delivery.spec.ts` covers the courier workflow: the happy path once, then every refusal —
  wrong courier, wrong bags, wrong moment, wrong role, cross-tenant.
  `accounting.spec.ts` reproduces the client's own quarterly VAT figures to the halalah;
  `hr.spec.ts` covers the cost base, the seasonal employee charges and both Excel export phases;
  `commissions.spec.ts` covers the card commission rates, the source-agnostic transaction ingest,
  the reconciliation, and the fact that a bank commission is booked as an expense and never as a
  tax.
- Frontend: `cd frontend && npm run test:e2e` — browser tests against the **live** Docker
  backend (login/theming, full Shop & Drop, the **physical scan-in** enforcement, the retrieval
  verification gate, the **public tracking page**, Mobility + COTE, all nav routes, tablet,
  phone prefix, and the **two-session courier handover** driven from two parallel browser
  contexts — one agent, one courier).

> ⚠️ The browser suite runs against a **persistent** Docker database with finite seeded
> compartment pools (6×S, 8×M, 8×L, 4×XL). Any test that stores bags holds a unit forever, so
> specs call `releaseStoredBooking()` to hand it back. Without that, repeated runs slowly starve
> the estate and later specs fail with *"No available unit to reserve"*.

## 15. How to run

```bash
# Backend (Docker: Mongo + Redis + API)
cd lockerflow-platform/backend && docker compose up -d --build   # http://localhost:4000

# Frontend
cd lockerflow-platform/frontend && npm install && npm run dev      # http://localhost:5175
```
**Agent login:** `agent.wayz@lockerflow.demo` / `Agent@123`.
**Lagoon agent** (the same workspace, narrowed to one activity): `lagoon.wayz@lockerflow.demo` / `Agent@123`.
**Manager:** `manager.wayz@lockerflow.demo` / `Manager@123`.
**Delivery agents:** `courier.wayz@lockerflow.demo` and `courier2.wayz@lockerflow.demo` / `Courier@123`
— see [DELIVERY_AGENT.md](DELIVERY_AGENT.md).
**The till:** worked by the kiosk agent — see [TILL.md](TILL.md). There is no cashier seat.

---

## 16. Manager FAQ (anticipated questions)

- **"How do we sell this to another client with their colours/font?"** → §8. Clone the project and
  change the `--brand` / `--secondary` / `--switch` / `--font` variables in one file
  (`frontend/src/styles/globals.css`). It re-skins the entire platform — no code rewrite, and it
  applies to every tenant/user in that deployment.
- **"How do we add a new engine like camel rides?"** → §5.4. One workflow file + register + seed.
  The generic engine and all routes consume it unchanged.
- **"Where does the business logic live?"** → In declarative **workflows** (guards/effects), not
  scattered `if`s. Isolated, swappable, testable.
- **"Why two state libraries?"** → §3. React Query = server state (caching/refetch/invalidation);
  Zustand = a few UI flags (auth/theme). Different jobs.
- **"Is payment tied to the timer?"** → No. Payment only confirms the booking; the timer starts
  exclusively on the fulfilment action (Confirm Storage / Handover / Trip Start).
- **"If a customer is 3 minutes late, do they pay?"** → No — §7.0. The first 5 minutes are a free
  grace period. At 5 minutes and one second they owe a **full hour**, and each further hour is
  another block. They are warned on WhatsApp ~15 min before expiry, and their tracking page
  shows the running total.
- **"Is the tracking link safe to share?"** → §7.2. It exposes only the countdown, item
  descriptions and the penalty — never bag barcodes (the claim token), never customer details.
  Treat the link itself as private: anyone holding it can see the session.
- **"Can an agent start the timer without actually putting the bags in the locker?"** → No. §7.1.
  `TO_STORED` requires the compartment scan to match the reservation and the bag scans to match
  the registered bags exactly — a missing bag, someone else's bag, or the same bag waved twice
  all block it, and nothing is stored.
- **"What stops the wrong person collecting someone's bags?"** → §11.1. Retrieval will not start
  without a fresh identity proof: a WhatsApp code to the number **on the booking**, or — if the
  provider is down or the customer has lost their phone — a captured ID document, or a manager
  override signed with the manager's own credentials. Every route is audited; the proof is
  burned on use.
- **"What if Vonage/WhatsApp is down — are we stuck?"** → No. Delivery failure is reported as
  `FAILED` and the agent moves to the ID-document fallback. Crucially, the code is **not** shown
  to the agent in that case — a code you were just shown proves nothing about the customer.
- **"Can an agent see another company's data?"** → No — every query is tenant + station scoped
  from the JWT; verified by isolation tests.
- **"Where do the tax figures come from?"** → §6 and [ACCOUNTANT.md](ACCOUNTANT.md). Money is
  stored VAT-inclusive and split into base + VAT the moment it is taken, so nothing is re-derived
  later. VAT due is `(sales − returns − purchases) × tenant rate`; Zakat is 2.5% of net profit and
  zero when the year is not in profit. The rate lives on the tenant record, never in the code.
- **"Who enters the costs?"** → HR ([HR.md](HR.md)). Supplier invoices, repairs, fuel, rent and
  the seasonal employee charges. The accountant reads those figures and cannot change them; HR
  cannot see revenue. The separation is enforced on the server, not just in the UI.
- **"How does the card commission work?"** → The bank withholds a contract rate per card scheme
  (Mada/SPAN 0.75%, Visa/Mastercard 2.60%, GCC 1.75%, all editable by the accountant). The
  withheld amount is booked as an **expense, never as a tax** — it lowers the taxable base and the
  net profit, and no input VAT is reclaimed on it.
- **"Where do the card transactions come from — the terminal or a data feed?"** → Either. Both
  arrive through one ingest path into one collection, and the row records which source it came
  from. Nothing above the ingest layer knows the difference, so switching integrations changes
  nothing downstream.
- **"Is it production-ready?"** → It's a demo-grade MVP: real API, DB, Docker, tests. Not yet
  hardened for production (no Twilio, no HTTPS/secrets management, mock auth).

## 17. Known limitations / next steps

- Non-Shop&Drop engine workflows are **assumed** (swap on receipt of the real ones).
- OTP is a mock (Twilio pending); printing uses `window.print()`.
- Manager dashboard is an intentional stub.
- Payments/Receipts have no dedicated list pages yet (shown within the booking view).
- Auth is a frontend-friendly JWT mock — not production-hardened.
- The card transaction feed is ingested through an HTTP endpoint with a mocked table behind it;
  the real TPE or acquirer integration plugs into `ingestTransactions()` without touching
  anything above it.
- Zakat deducts the VAT already paid before applying 2.5%, following the client's "we pay the tax
  then the zakat" description. Worth confirming against their accountant's own treatment.
- Customer refunds are issued at the desk, or above the counter for a till correction. The client mentioned HR entering refunds;
  that conflicts with the till flow and was left as-is pending confirmation.
