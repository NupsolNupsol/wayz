# WAYZ — Manager Workspace

> Everything built for the manager profile: what exists, why it is shaped that way, which parts
> of the intern's specification I accepted or changed, and the answers to the questions the
> manager is most likely to ask.

---

## 1. Credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Manager** | `manager.wayz@lockerflow.demo` | `Manager@123` | `/manager` — the workspace below |
| Agent (Shop & Drop + Mobility) | `agent.wayz@lockerflow.demo` | `Agent@123` | Agent workspace |
| Agent (Lagoon) | `lagoon.wayz@lockerflow.demo` | `Agent@123` | The same workspace, narrowed to one activity |
| Delivery agent | `courier.wayz@lockerflow.demo` | `Courier@123` | `/courier` — see [DELIVERY_AGENT.md](DELIVERY_AGENT.md) |
| Delivery agent (2nd) | `courier2.wayz@lockerflow.demo` | `Courier@123` | Same site — proves the job broadcast |
| Kiosk agent (works the till) | `agent.wayz@lockerflow.demo` | `Agent@123` | `/dashboard`, then Till — see [TILL.md](TILL.md) |
| Tenant admin | `admin.wayz@lockerflow.demo` | `Admin@123` | `/admin` — owns the company record |
| HR | `hr.wayz@lockerflow.demo` | `People@123` | `/hr` — see [HR.md](HR.md) |
| Accountant | `accountant.wayz@lockerflow.demo` | `Account@123` | `/accounting` — see [ACCOUNTANT.md](ACCOUNTANT.md) |

App: **http://localhost:5175** · API: **http://localhost:4000**

Start: `cd backend && docker compose up -d` then `cd frontend && npm run dev`.

---

## 2. What the manager can do

Thirteen modules, all tenant-wide (every station, not one counter).

| Module | Route | What it does |
|---|---|---|
| **Dashboard** | `/manager` | Revenue today / 7d / 30d, active sessions, overdue with penalty accruing, open incidents, cash variances, estate utilisation, 14-day revenue trend, revenue by service, per-station activity |
| **Live sessions** | `/manager/live` | Every running session across all stations, with live countdown and penalty |
| **Rentals** | `/manager/rentals` | Active / Overdue / Completed / All, filterable and sortable |
| **Rental detail** | `/manager/rentals/:id` | Session, order lines, payments, items, custody trail |
| **Customers** | `/manager/customers` | Directory with booking counts and last-seen |
| **Customer detail** | `/manager/customers/:id` | Lifetime value + full rental history |
| **Payments** | `/manager/payments` | Every transaction, refunds flagged |
| **Incidents** | `/manager/incidents` | Tenant-wide queue with the approval ladder |
| **Shifts & cash** | `/manager/shifts` | Reconciliation, variances awaiting approval |
| **Organisation** | `/manager/organisation` | **Site → Station → Kiosk** tree; create/edit/deactivate each level |
| **Assets** | `/assets` | The shared estate — see [ASSETS.md](ASSETS.md). Create a kind, add assets to it, price a kind or one asset, suspend, print QR codes |
| **Pricing** | `/manager/pricing` | Base price, overtime hourly rate, deposit, billing model per product |
| **Team** | `/manager/team` | Create **kiosk agents, chief captains, supervisors and delivery agents**; set role, assign a station, pick the **activity** first and then the **desk** that runs it, file a sub-manager under a lead, suspend, reset password |
| **Settings** | `/manager/settings` | Company details, VAT, currency, grace period, overtime block, payment methods, verification channels |
| **Reports** | `/manager/reports` | Revenue / occupancy / rentals over any date range, **CSV export** |
| **Activity log** | `/manager/activity` | Audit trail — every override, reassignment, verification |

---

## 2b. What a manager cannot do

A manager runs the operation but never touches a transaction.

| | **Agent** | **Manager** |
|---|---|---|
| Where they work | **At one station**, on the activities they are assigned to | **Above** the stations, the whole tenant |
| Workspace | `/dashboard` and the counter screens | `/manager` |
| Can run the counter? | **Yes** | **No** — cannot create a booking, store bags or run a retrieval |
| Reach | Their own station and their own activities | Every site, station and kiosk |
| Signature power | None — they ask for one | **Authorises exceptions**: identity overrides, refunds, cash variances — and **sets the rules**: pricing, staff and their associations, sites, stations, kiosks, VAT, grace period |

The role model in full — all five roles, their scopes and every boundary — is in
[ROLES.md](ROLES.md).

---

## 3. The hierarchy the client asked for

> *"the tenant usually could have many sites, in each site could have many stations, in each
> station could have multiple kiosks and in each kiosk could have multiple compartments"*

This is now the real data model:

```
Tenant  (WAYZ)
└── Site            Riyadh Boulevard (MALL) · KKIA Terminal 1 (AIRPORT)
    └── Station     Shop & Drop — Gate 1 · KKIA T1 Arrivals
        └── Kiosk   Kiosk A · Kiosk B · Arrivals Kiosk
            └── AssetUnit   the individual compartments / vehicles / boats
```

**Kiosk is a new entity** (`backend/src/models/org.model.ts`), and `AssetUnit.kioskId` places
every compartment inside one. That is what lets a manager say *"Kiosk B is full"* or take one
cabinet out of service without closing the whole station.

`Zone` still exists between Site and Station from the original model. It is optional and no
longer required — kept only so existing records stay valid.

**Nothing is ever deleted.** Sites, stations, kiosks, products and staff are *deactivated*.
Every one of them is referenced by bookings, payments and audit records; deleting the row would
orphan history and make past transactions unexplainable.

---

## 4. My review of the intern's specification

He did a solid job of cataloguing the Wazen dashboard. Four things needed correcting before
building, and one is a genuine business risk.

### 4.1 The document is pasted twice
`managerExpectationByCoworker.txt` repeats itself in full from line 242. Same ten modules, same
text. Worth telling him so the next draft is clean.

### 4.2 "Lockers" is too narrow for WAYZ  — **corrected**
The spec describes a locker-only business, with an entire *Lockers* module and *"hourly price
per locker category"*. WAYZ is **multi-engine**: compartments, vehicles, boats, restaurant
tables and animals. Building a Lockers module would have broken four of our five engines.

I built **Assets** instead, keyed on asset *type*, and put pricing on the **catalogue product**
where it already belongs. Occupancy is reported per asset type rather than as one number, so
boats and lockers are not averaged into a meaningless figure.

### 4.3 The hierarchy was missing — **added**
His spec goes straight from Station to Lockers: no sites, no kiosks. The client explicitly
called out four levels. Section 3 above is the correction.

### 4.4 "SMS/OTP settings" as an editable page — **deliberately refused**
He specified a page to configure the messaging provider. **I did not build that**, and the
Settings page says so on screen.

Those credentials (WhatsApp/Vonage, SMTP) are deployment secrets. A web form for them would let
anyone with a manager session **redirect the one-time codes that protect customers' luggage** to
a phone or inbox they control. That is the exact control we spent this project hardening.

What the manager *can* do: choose which channels the counter may offer (WhatsApp / Email), and
see that the ID-document and manager-override fallbacks are always available. Credentials
change in the environment, by an administrator.

### 4.5 "System Logs" — **narrowed**
He asked for technical error logs in the UI. Stack traces in a business dashboard are noise at
best and an information leak at worst. The **Activity log** gives full business traceability
(who did what, when, why) from the audit trail. Technical logs stay in the container.

### 4.6 Other judgement calls
- **Excel export** → CSV only. It opens natively in Excel and Sheets, adds no library to the
  bundle, and cannot carry a macro. The CSV is generated server-side so the file matches the screen.
- **Refunds** → listed and flagged, not processed. We have no refund *flow* yet; a "Refunds"
  page that cannot refund would be a lie.
- **Roles & Permissions editor** → not built. Our permission matrix is code-defined and
  enforced server-side. A DB-editable matrix is a real feature, but a half-done one is how you
  lock yourself out of your own tenant. Roles are assigned per user in Team.

### 4.7 What I added that was not in the spec
Kiosks · station opening hours and codes · agent→station assignment ("associations") ·
overtime hourly rate per product · grace-period and overtime-block configuration · VAT and
currency · lifetime customer value · penalty accruing right now · CSV export · the audit trail
view.

---

## 5. Architecture

### 5.1 Where the code lives
```
backend/src/
  services/manager.service.ts    dashboard, live sessions, rentals, customers, payments
  services/asset.service.ts      asset kinds + individual assets (shared with HR and the tenant admin)
  services/org.service.ts        Site → Station → Kiosk CRUD + deactivation rules
  services/staff.service.ts      agents: create, edit, assign, suspend, reset password
  services/pricing.service.ts    catalogue pricing + tenant settings
  services/reports.service.ts    revenue / occupancy / rentals + CSV + activity log
  controllers/manager.controller.ts   zod validation, tenant scoping
  routes/manager.route.ts        one RBAC guard for the whole router
  routes/asset.route.ts          /api/assets — read: manager, admin, HR, agent; write: manager, admin, HR

frontend/src/features/manager/
  ManagerOverview.tsx   ManagerOrg.tsx      ManagerTeam.tsx
  ManagerPricing.tsx    ManagerSettings.tsx ManagerReports.tsx
  ManagerRecords.tsx    ManagerOperations.tsx

frontend/src/features/assets/          one estate for manager, tenant admin and HR
  AssetsPage.tsx        AssetTypeDetailPage.tsx  AssetUnitPage.tsx
  NewAssetKindModal.tsx AssetQrModal.tsx
```

### 5.2 Manager scope is tenant-wide
Agent endpoints scope every query to `tenantId + stationId` from the JWT. Manager endpoints
scope to `tenantId` **only** — station becomes a *grouping dimension*, never a filter that hides
data from the person responsible for it. That single difference is what makes the workspace
"oversight" rather than "a second counter".

### 5.3 One RBAC guard, at the router
```ts
router.use(authenticate, requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'))
```
Applied once at the top, so a new endpoint added here **cannot** ship unprotected by accident.
Verified: an agent token gets `403` on every manager route.

### 5.4 Money is never recomputed
Overtime penalties on the dashboard, in reports and on the rental detail all call the same
`domain/overtime.ts` the agent console and the customer's tracking page use. Three surfaces,
one implementation — they cannot quote three different numbers for the same session.

### 5.5 Prices are snapshotted
When a booking is created, the price and the overtime rate are **copied onto it**. Editing a
price in the manager screen therefore affects **new bookings only** — a session already running
keeps the price it was sold at. That is what makes repricing safe during trading hours, and the
Pricing page says so on screen.

---

## 6. Guardrails (all verified)

| Attempt | Result |
|---|---|
| Suspend your own account | `422` — *"You cannot change your own role or suspend your own account."* |
| Deactivate a station holding live sessions | `422` — *"still has 1 live session(s) — close them first."* |
| Deactivate a kiosk with occupied compartments | `422` — *"has N unit(s) in use — empty it first."* |
| Grant yourself `SUPER_ADMIN` | `403` — *"A manager may not assign the SUPER_ADMIN role."* |
| Set VAT to 300% | `400` — validated as a fraction 0–1 |
| Suspend an agent mid-shift | `422` — reconcile the till first |
| Agent opens any `/api/manager/*` | `403` |
| Password hash in an API response | Never — stripped in the service layer |

---

## 7. Questions the manager will ask

**"Can I see all my stations at once?"**
Yes. The dashboard aggregates the whole tenant and breaks activity down per station; Live
sessions and Rentals span every station.

**"Can I add a new mall / airport myself?"**
Yes — Organisation → Add site, then add stations under it, then kiosks under those. No developer
involved.

**"Can I hire an agent and have them working today?"**
Yes. Team → Add member: name, email, role, station, initial password. They can sign in
immediately. Verified end-to-end in the test suite.

**"Can I change prices?"**
Yes — Pricing. Base price, overtime hourly rate, deposit and billing model per product. Changes
apply to new bookings; running sessions keep the price they were sold at.

**"How much am I losing to late collections?"**
Dashboard shows overdue sessions with the penalty accruing right now. Reports → Revenue breaks
out overtime revenue separately.

**"Which lockers are busiest?"**
Assets shows utilisation per asset type; Reports → Occupancy gives the same per station, with a
CSV export.

**"Why can't I delete a station?"**
Because bookings, payments and audit records point at it. Deactivating takes it out of operation
and keeps the history readable. It also refuses while customers' property is still inside.

**"Why can't I change the SMS provider settings?"**
Section 4.4. Those credentials guard the codes that release customers' luggage; they are
environment secrets, not a web form. You choose which channels are offered — an administrator
changes the credentials.

**"Can my agents see the revenue?"**
No. Every manager route is role-gated; agents get 403 and are redirected to their own workspace.

**"Can WAYZ see WIQAR's data?"**
No. Every query is scoped by tenant. Covered by isolation tests.

**"What about the other roles — delivery agent, HR, accountant?"**
Not built yet, by design. The role union and the permission matrix already carry them
(`TECHNICIAN`, `FINANCE_OFFICER`, …); adding a workspace is the same shape as this one.

---

## 8. Not built (deliberately, and worth saying out loud)

- **Refund processing** — refunds are listed, not issued. Needs a real flow and a payment
  gateway.
- **Editable roles & permissions matrix** — assign roles per user today; a DB-driven matrix is a
  separate piece of work.
- **Provider credential editing** — see 4.4.
- **Excel/PDF report export** — CSV only for now.
- **Other role workspaces** — HR, accountant. (The **delivery agent** workspace and the **till**
  are now built — see [DELIVERY_AGENT.md](DELIVERY_AGENT.md) and [TILL.md](TILL.md).)
- **Manager-facing session actions** — the workspace is oversight; the agent console still
  performs storage and retrieval.

---

## 9. Verification

- Backend: typecheck + lint clean; all 16 manager endpoints return 200; every guardrail in
  section 6 confirmed by direct API calls.
- Frontend: typecheck + lint clean; manager browser suite covers the dashboard, all thirteen
  modules, the org tree, agent creation with a real sign-in, repricing, settings, CSV download,
  and the agent-blocked case.
- Database wiped and reseeded, so the hierarchy above is what you will see on first login.
