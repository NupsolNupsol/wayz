# WAYZ — the role model

> Every role the platform runs, what each one is for, what each one deliberately cannot do,
> and where each boundary is enforced.
>
> This is the client's hierarchy from section 3 of the requirements, with the overrides they
> asked for: the cashier is folded into the kiosk agent, the expense manager and the inventory
> keeper are folded into HR, the CEO **is** the tenant admin, and the IT manager, chief
> accountant, general controller, technician and partner seats are not built.

---

## 1. Credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| **CEO / tenant admin** | `admin.wayz@lockerflow.demo` | `Admin@123` | `/admin` |
| **Project manager** | `projects.wayz@lockerflow.demo` | `Project@123` | `/manager` |
| **Activity manager** (Shop & Drop + Mobility) | `manager.wayz@lockerflow.demo` | `Manager@123` | `/manager` |
| **Activity manager** (Lagoon) | `lagoon.manager.wayz@lockerflow.demo` | `Manager@123` | `/manager` |
| **Supervisor** (Shop & Drop + Mobility) | `supervisor.wayz@lockerflow.demo` | `Super@123` | `/manager` |
| **Supervisor** (Lagoon) | `lagoon.supervisor.wayz@lockerflow.demo` | `Super@123` | `/manager` |
| **Accountant** | `accountant.wayz@lockerflow.demo` | `Account@123` | `/accounting` |
| **HR & expenses** | `hr.wayz@lockerflow.demo` | `People@123` | `/hr` |
| **Kiosk agent** · Iran (Shop & Drop) | `agent.wayz@lockerflow.demo` | `Agent@123` | `/dashboard` |
| **Kiosk agent** · Morocco (Shop & Drop) | `agent.morocco.wayz@lockerflow.demo` | `Agent@123` | `/dashboard` |
| **Kiosk agent** · Gate 1 (Mobility) | `agent.gate1.wayz@lockerflow.demo` | `Agent@123` | `/dashboard` |
| **Kiosk agent** · Egypt (Lagoon) | `agent.egypt.wayz@lockerflow.demo` | `Agent@123` | `/dashboard` |
| **Kiosk agent** · Mountain jetty (Lagoon) | `welcome.wayz@lockerflow.demo` | `Lagoon@123` | `/dashboard` |
| **Chief captain** · France jetty | `captain.wayz@lockerflow.demo` | `Lagoon@123` | `/dashboard` |
| **Delivery agent** | `courier.wayz@lockerflow.demo` | `Courier@123` | `/courier` |
| **Delivery agent (2nd)** | `courier2.wayz@lockerflow.demo` | `Courier@123` | `/courier` |

The demo database carries **WAYZ alone**. A second tenant is seeded only where the isolation
tests need one, so nothing clutters the demo.

App: **http://localhost:5175** · API: **http://localhost:4000**

---

## 2. Three levels of scope

Every role answers for exactly one of three things, and `domain/roles.ts` is the single place
that says which:

| Level | Sees | Roles |
|---|---|---|
| **Desk** | One kiosk of one activity | Kiosk agent, chief captain |
| **Activity** | Named activities, across every desk | Supervisor, activity manager |
| **Tenant** | Everything | Project manager, HR, accountant, CEO, delivery agent |

A desk-scoped account with no kiosk on its token sees **nothing**, not everything — a missing
scope must never widen access.

---

## 3. The roles, and what each is for

### The floor

| Role | Scope | Exists to |
|---|---|---|
| **Kiosk agent** | One kiosk, one activity | Serve the customer *and* work the till: register bags, take them in, reserve a compartment, scan in and out, run retrievals, hand over a scooter or a boat, raise delivery requests, release bags to a courier, take payments, run the cash drawer, count and close |
| **Kiosk agent** (Lagoon jetty) | One lagoon jetty | Take the booking and the money at the water's edge — the same agent role, on a lagoon kiosk |
| **Chief captain** (Lagoon) | One lagoon jetty | Run the boats at that jetty and answer for their condition |
| **Delivery agent** | One **site** | Carry bags from a kiosk to wherever the customer asked |

**There is no cashier.** The client asked for the seat to be removed and its authority folded
into the agent, so one person now serves the customer and takes their money. The till lives at
`/till` inside the agent's own workspace, and the printed invoice names them.

### The line management

| Role | Scope | Exists to |
|---|---|---|
| **Supervisor** | Their activities, every desk | Oversee the floor: live sessions, incidents, shift closes, the reports they reconcile against, and authorising an exception. **Configures nothing.** |
| **Activity manager** | Their activities | Run one project: its desks, its staff, its price book, its settings, its reports |
| **Project manager** | The whole tenant | Run every project, with the activity managers reporting up to them |
| **CEO / tenant admin** | The whole tenant | Own the company: the company record, branding, the tax rate, the operating rules, the penalty schedule, the audit trail, and approving a manual sale |

**Sub-managers.** A manager or supervisor carries a `reportsTo`, and the server refuses to file
someone under a lead who does not actually outrank them.

### Finance

| Role | Scope | Exists to |
|---|---|---|
| **HR & expenses** | The whole tenant | Record what the business **spends**, and keep the inventory book: supplier invoices, repairs, maintenance, fuel, venue and accommodation rent, payroll, and the estate |
| **Accountant** | The whole tenant | Read what the business **earned and owes**: the VAT return, the Zakat position, the activity figures, the card commissions, the Excel exports, and entering a manual sale for someone else to approve |

**Why HR and the accountant are separate.** The person who enters a cost is not the person who
reports on it. HR writes the cost base; the accountant reads it and files against it. Neither can
do the other's job, and neither can touch a booking, a payment or a refund.

### Not built

`CASHIER` (folded into the agent), `IT_MANAGER`, `CHIEF_ACCOUNTANT`, `GENERAL_CONTROLLER`,
`EXPENSE_MANAGER` and `INVENTORY_KEEPER` (folded into HR), `TECHNICIAN`, `TUKTUK_SUPERVISOR`
and `PARTNER` exist nowhere in the platform — not in the role union, not in the API, not in any
list an admin can pick from. Each was either explicitly out of scope or had no workspace to land
in, and an account that can sign in with nowhere to go is worse than no account.

---

## 4. Who can create whom

| Creator | May assign |
|---|---|
| **Activity manager** | Kiosk agent, delivery agent, supervisor, chief captain |
| **Project manager** | All of the above, **plus** activity manager |
| **CEO / tenant admin** | All of the above, **plus** project manager, accountant and HR |
| Nobody | `TENANT_ADMIN` — it is never assignable through the staff API |

Enforced by `ASSIGNABLE_BY` in `domain/roles.ts`, checked on the server on every create and
every role change. The Team form only offers what the signed-in role may actually assign, so the
UI and the server agree.

### The associations

**Team → Add member → role → station → activity → desk.**

| Assigning… | Ties them to | What that scopes |
|---|---|---|
| Kiosk agent, chief captain | a **station**, exactly **one activity**, and a **kiosk of that activity** | Only that desk — the sidebar, the catalogue, the bookings, the till and the dashboard all stop there |
| Supervisor, activity manager | a **station** and **one or more activities** | Those activities across every desk |
| Manager, supervisor | optionally a **lead** | Where they sit in the chain |
| Delivery agent | a **station** | Their **site** — every unclaimed job in it is offered to them |
| Project manager, HR, accountant, CEO | a station (nominal) | Nothing — these are tenant-wide |

The activity is chosen **first**, and the desk list narrows to kiosks that run it. A chief
captain is only ever offered the lagoon. The server refuses every one of these cases too — a
desk at the wrong station, a desk running a different activity, a water role on dry land — so
the two halves of the association can never disagree.

---

## 5. The boundaries, and where each is enforced

| Boundary | Enforced by |
|---|---|
| A supervisor oversees but does not configure | `/api/manager/*` opens to `FLOOR_LEADS`; every write on it carries `requireRole(...BACK_OFFICE)` |
| Only the CEO reaches `/api/admin/*` | `requireTenantAdmin` on the router |
| Only HR or the CEO reaches `/api/hr/*` | `requireHr` on the router |
| Only an accountant or the CEO reaches `/api/accounting/*` | `requireRole('ACCOUNTANT','TENANT_ADMIN')` |
| Only a courier reaches `/api/deliveries/courier/*` | route-level role guard |
| Only desk staff release bags to a courier | `actors: KIOSK_OPS` **in the workflow data** |
| A desk sees only its own bookings | `kioskFilter` from `domain/access.ts` narrows the list and `loadBooking` 404s anything else |
| An activity role sees only its activities | `engineFilter` narrows every query; `canWorkEngine` refuses every write |
| Money is only ever given back with a reason | both refund paths demand one and write it to the audit trail |
| Nobody refunds more than was taken | every refund sums what has already gone back on that order first |
| A till refund needs someone above the counter | `requireRole(...FLOOR_LEADS)` on `/api/till/payments/:id/refund` |
| Nobody signs off their own cash variance | `requireRole(...FLOOR_LEADS)` on resolve |
| Nobody approves their own manual sale | the service refuses when `enteredBy` is the reviewer |
| The accountant can move no money | every write route outside `/api/accounting/*` and `/api/manual-sales` returns 403 |
| HR can read no revenue | `/api/accounting/*` returns 403 to HR |

Scope is never a parameter a client sends. It comes off the JWT — `tenantId`, `stationId`,
`kioskId` and `engineKinds` — so there is no URL or filter anyone can change to widen it. Asking
for another activity by hand (`?engineKind=…`) returns nothing rather than someone else's rows.

---

## 6. The workspaces

| Role | Screens |
|---|---|
| **Kiosk agent / chief captain** | Dashboard, New Transaction, their activity, Active operations, Deliveries, **Till, Awaiting payment, Transactions, Cash drawer**, Assets, Incidents, Customers, Bookings, Shift, Notifications |
| **Delivery agent** | Delivery board, the task screen, Completed, Notifications |
| **Supervisor** | Dashboard, Live sessions, Rentals, Customers, Payments, Incidents, Shifts & cash, Till & drawer, Manual sales, Assets, Reports, Activity log, Notifications |
| **Activity manager / project manager** | All of the supervisor's, **plus** Organisation, Pricing, Team and Settings |
| **CEO / tenant admin** | Overview, Company & branding, **Operating rules**, Data & isolation, the whole estate, Employees, Accounts & roles, every operational screen, Manual sales, Reports, VAT & finance, Costs & seasons, Card commissions, Audit trail |
| **HR & expenses** | Costs, Seasons & payroll, Assets, Notifications |
| **Accountant** | VAT & activities, Card commissions, Transactions & reconciliation, Manual sales, Notifications |

Page-by-page detail lives in the in-app manual (**Help & docs → User manual**), and in
[TILL.md](TILL.md), [DELIVERY_AGENT.md](DELIVERY_AGENT.md),
[MANAGER_WORKSPACE.md](MANAGER_WORKSPACE.md), [HR.md](HR.md), [ACCOUNTANT.md](ACCOUNTANT.md)
and [WAYZ_COMPLIANCE.md](WAYZ_COMPLIANCE.md).

---

## 7. Verification

**API pass — `cd backend && npm test`.** Two suites against the live stack, both idempotent so
they can be run back to back.

`tests/roles.api.mjs` — every seeded role signs in and lands where it should; the old cashier
login is refused and `/api/cashier` is gone; a desk sees its own bookings and 404s another's; an
activity manager's rentals and estate carry one activity; a supervisor reads the floor and is
refused every write; a kiosk agent cannot be hired without a desk, onto another activity's desk,
or as a chief captain on dry land; the operating rules read and re-price; notifications reach the
right people and clear per person; a manual sale cannot be self-approved, cannot be dated in the
future, and cannot be approved twice; the per-agent statement exports; and the invoice carries the
CR number, the VAT number, the branch, the desk and the agent's own name.

`tests/rules.api.mjs` — section 8.1 driven end to end: the clock starts five minutes after the
money lands, a replacement adds the tenant's ten minutes and moves the faulty unit to
maintenance, a return to another station charges the tenant's twenty-five and re-homes the
vehicle, every one of those figures follows the setting when it is changed, and a unit can be
moved between stations by hand but never onto a desk that runs a different activity.

**Browser specs** across the roles, the till, the desks, the operating rules, notifications,
manual sales and the invoice — in English and in Arabic.
