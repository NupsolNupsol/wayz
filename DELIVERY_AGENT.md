# WAYZ — Delivery Agent

> The courier profile: how a customer's bags get from a locker to wherever they asked, who is
> allowed to move them at each step, and why the flow is shaped this way.

---

## 1. Credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Delivery agent** | `courier.wayz@lockerflow.demo` | `Courier@123` | `/courier` — the board |
| **Delivery agent (2nd)** | `courier2.wayz@lockerflow.demo` | `Courier@123` | Same site — proves the broadcast |
| Agent (the kiosk side) | `agent.wayz@lockerflow.demo` | `Agent@123` | `/deliveries` |
| Manager | `manager.wayz@lockerflow.demo` | `Manager@123` | Creates courier accounts |

App: **http://localhost:5175** · API: **http://localhost:4000**

There are **two** couriers on purpose. An unclaimed job is offered to every courier on the
site, so the race for work — and the kiosk agent's "is this the right courier?" check — cannot
be demonstrated from a single account.

**Seeded data on first login:** `dlv-0001` is waiting on the board (Sara Kamal, Rosewood Hotel)
and `dlv-0002` is a completed job in the courier's history.

---

## 2. The problem this solves

The customer has **no account**. They cannot raise a delivery themselves, and after they walk
away the platform has no way to hear from them except through the kiosk. So every request is
created by the kiosk agent, on their behalf, and the only question that matters is:

> How do we know the person asking is really the customer, and the person collecting is really
> the courier we sent?

Everything below is an answer to one half of that question.

---

## 3. The flow

```
KIOSK AGENT                     COURIER                        KIOSK AGENT
     │                             │                                │
  raise request               claim the job                         │
  (identity proved         (first one wins — the                    │
   if by phone)             others stop seeing it)                  │
     │                             │                                │
     └────────► REQUESTED ────────►│                                │
                                ASSIGNED                            │
                                   │                                │
                          walk to the kiosk,                        │
                          "request the bags" ──► RELEASE_REQUESTED ─┤
                                   │                                │
                                   │                     check ID against the
                                   │                     assigned courier's name,
                                   │                     tick the box, type the
                                   │                     compartment code
                                   │                                │
                                   │◄──── RELEASE_APPROVED ─────────┘
                            code appears on
                            their phone (15 min)
                                   │
                            open the compartment,
                            SCAN EVERY BAG
                            (code dead? "Ask the agent
                             again" → RELEASE_REQUESTED)
                                   │
                              PICKED_UP  ──► compartment freed, bags IN_TRANSIT,
                                   │          custody LOCKER → PORTER
                            deliver to the address
                                   │
                              DELIVERED ──► booking COMPLETED, bags DELIVERED,
                                            custody PORTER → CUSTOMER
```

### When the bags are at more than one kiosk

A customer who shopped all day can have left bags at several kiosks. They ring one desk and ask
for the lot, so the request covers all of them.

```
       the desk that took the call                     the courier
   ┌──────────────────────────────────┐        ┌──────────────────────────────┐
   │ "Send to customer" asks the DB   │        │ Stop 1 · Iran      ← now     │
   │ what else this customer holds:   │        │ Stop 2 · Morocco   queued    │
   │  ☑ Morocco  M-08 · 2 bags        │  ───►  │ Stop 3 · Levant    queued    │
   │  ☑ Levant   S-03 · 1 bag         │        └──────────────────────────────┘
   │  ☑ Bring everything              │          each stop: ask that kiosk's
   └──────────────────────────────────┘          agent → code → scan → next
```

- The stops are built when the request is raised: the desk that took the call first, then one per
  kiosk the customer picked. Each stop records the booking, the kiosk, the compartment and the
  bags expected there.
- Collecting a stop runs the ordinary pick-up against *that* booking — same scan-blind rule, same
  code — then rolls the job on to the next kiosk and clears the spent code, so a courier can
  never carry one kiosk's code to another.
- The kiosk board names the kiosk the courier is standing at and marks whether it is yours.
- At the door the courier collects **one total for the whole run** — the delivery charge plus
  anything owed on any booking in it — and the hand-over is refused until it is paid. Delivering
  then closes every booking on the run and frees every compartment.

### Money at the door

The courier carries a card terminal and a drawer of their own. The task shows **one total** — the
delivery charge plus anything the customer ran up while their bags were out, across every booking
on the run — and the *Mark delivered* button stays disabled until it is settled, with the amount
spelled out next to it.

Taking money needs the courier's own till open, the same rule the counter works under: cash lands
in their drawer and is counted against it at the end of the shift, while the sale itself stays
attributed to the desk that made it, so the kiosk's takings are not distorted by where the
customer happened to pay.

### Where a request comes from

| Origin | When | What it costs the agent |
|---|---|---|
| **At the desk** | The customer asks while their bags are going in | Nothing — they are standing there |
| **By phone** | They call or message the kiosk later | A **fresh identity check** on the booking, which is then spent on this request |

The agent picks which one applies. That choice is the whole basis of the control, so it is an
explicit answer, never inferred — and the audit trail records what they claimed.

---

## 4. The four controls

**1 · Only stored bags can be sent.** The booking must be `ACTIVE` or `OVERTIME` and belong to
Shop & Drop. A rental has no bags; a completed booking has none left.

**2 · A phoned-in request needs proof.** A code goes to the phone or email recorded on the
booking *before* the call — never to a number read out during it. The three ranked methods are
the same ones used at the counter (WhatsApp / email → ID document → manager override), and
the proof is **consumed** so it cannot open a second job.

**3 · The kiosk agent releases, never the courier.** `TO_RELEASE_APPROVED` is the only
transition in the workflow whose actor is the kiosk staff. A courier calling it — on either
route, with a valid job id — gets a 403. The agent must confirm the assignee by name and type
the compartment code, which they read off the kiosk itself; it is never derived from the
compartment number, so knowing which locker it is does not open it. The code lives on the
delivery, expires in **15 minutes**, and is destroyed the moment it is used.

A code that expires before the courier reaches the locker would otherwise strand them, so
`TO_RELEASE_REQUESTED` also has `RELEASE_APPROVED` as a source: the panel swaps itself for an
**"Ask the agent again"** button the second the countdown hits zero, the scan panel disappears
(offering it would be a dead end the server is bound to refuse), and the re-request destroys the
old code so a later approval cannot revive it.

**4 · The scan must match exactly.** Missing bag, someone else's bag, or the same bag scanned
twice — all refused, each with a message naming what went wrong. And the courier's screen
**does not show the barcodes**: a barcode is the claim token for a bag, so printing it there
would turn "scanning" into typing and the control would prove nothing.

> **Demo note.** A browser has no barcode scanner, so when the server runs with
> `DEMO_SCANNER=true` each bag row gets a **Scan** button (plus "Scan all bags") that stands in
> for the hardware, labelled as such on screen. In a real deployment the flag is off, the
> buttons never render, and the only way to fill the list is a physical scan.

---

## 5. What each person sees

### Courier — `/courier`

| Screen | What it is for |
|---|---|
| **Delivery board** | Three counters, then two lists: what they are carrying, and what is open at this site. Both refresh themselves. |
| **Task** `/courier/task/:id` | One job. Shows exactly the **one** next action — claim, request, wait, scan, deliver — plus the destination, a tap-to-call number, and the full activity trail. A run covering several kiosks also lists the **sub-tasks**: where to go now, what is queued, what is collected. |
| **Till** `/courier/shift` | Their own drawer: opened before any money is taken, counted at the end. |
| **Completed** | Delivered and failed jobs. |

### Kiosk agent — `/deliveries`

Counters, then **"Waiting at your desk"** — couriers physically standing there — above the full
table of everything raised at this station. Each row names the kiosk the courier is standing at
and marks whether it is yours, so a multi-kiosk run reads correctly from every desk it touches. The approval dialog leads with the assigned
courier's name, keeps the code field **disabled** until the agent ticks the identity check, and
warns in plain language what approving means.

The booking console also carries it: **"Send to customer"** raises a request, and a banner
appears while one is in flight so nobody starts a counter retrieval on bags a courier is
already on their way to collect.

### Manager

Team → Add member → role **"Delivery agent — takes bags to customers"**. Assign them a station;
that station's **site** becomes the area whose jobs they see.

---

## 6. Architecture

The courier flow is a **second entity in the `@wayz/workflow` package**, built exactly like the
booking engines the manager asked us to copy from chargeback:

```
workflow/
  shared/{status,access,types}.ts            statuses, roles, types — centralised
  deliveryWorkflowValidators/                the CONTROLLER  (may this happen?)
    controller.delivery.validator.controller.ts
  deliveryWorkflowOperations/                the OPERATOR    (what does the world look like after?)
    controller.delivery.operation.controller.ts
  workflow/delivery.workflow.ts              the transitions, as DATA
  workflow/delivery.registry.workflow.ts     dispatch, keyed on ASSET KIND
```

The package stays **pure** — no database, no HTTP. A validator receives a plain snapshot and
returns errors; an operator returns a new snapshot plus declarative intents (e.g. "put unit
`unit_wayz_M1` back to AVAILABLE"). `backend/src/services/delivery.service.ts` is the host that
loads, dispatches and persists.

Two things live in the host on purpose, because both are database questions:

- **the broadcast scope** — an unclaimed job is visible to every courier on the same *site*,
  which is a join from the courier's station up to its site;
- **the effect on the booking** — the bags belong to the booking, so bag statuses, custody
  events and the booking's own status are applied there, from the operator's output.

A tenant wanting couriers to move something other than compartments writes their own
`delivery.<kind>.workflow.ts` with a validator and an operator and adds one line to each
registry table. Nothing in the backend changes.

### API

| Method | Route | Who |
|---|---|---|
| `POST` | `/api/deliveries` | Counter (`AGENT`) |
| `GET` | `/api/deliveries/station` | Kiosk |
| `POST` | `/api/deliveries/station/:id/transition` | Kiosk — **including the release** |
| `GET` | `/api/deliveries/courier/board` | `DELIVERY_AGENT` |
| `POST` | `/api/deliveries/courier/:id/transition` | `DELIVERY_AGENT` |
| `POST` | `/api/deliveries/courier/:id/collect-stop` | `DELIVERY_AGENT` — finishes one kiosk and moves to the next |
| `POST` | `/api/deliveries/courier/:id/collect` | `DELIVERY_AGENT` — takes the money at the door |
| `GET` | `/api/deliveries/customer-bags/:bookingId` | Counter (`AGENT`) — what else this customer is holding |
| `GET` | `/api/deliveries/:id` | Either — scoped, and barcode-redacted for a courier |

The path segment *is* the permission boundary, so a courier cannot reach the release even with
a valid job id.

### Data

`DeliveryRequest` is its own collection, not a field on the booking, because it has a different
audience (couriers across a site), its own lifecycle that outlives the storage session, and one
booking can produce more than one over a long stay. Ids are sequential and readable —
**`dlv-0007`** — from the same counter collection as bookings.

A multi-kiosk run carries a `stops[]` array — one entry per kiosk, each with its booking,
compartment, expected bags and its own `PENDING`/`COLLECTED` state. The request's own kiosk and
compartment fields mirror the stop being worked right now, which is what lets the existing
single-kiosk workflow, screens and validators run unchanged against each leg in turn.

---

## 7. Verification

**Backend — 22 delivery specs (16 API + 6 package-level), 70 in the suite, all passing.**

The happy path is one test; the rest are refusals:

- request refused against unstored bags, a rental, a blank address, or a booking that already
  has an open delivery;
- a phoned-in request refused without proof, then accepted with it — and the proof shown to be
  consumed;
- two couriers race, exactly one wins, and the loser's board no longer offers it;
- a courier acting on someone else's job refused;
- release refused with no confirmation, with the **wrong** courier named, with no code, and
  with a malformed code;
- a courier refused the release on both routes (403);
- pickup refused for nothing scanned, one short, a foreign barcode, and a duplicate;
- the courier's payload proven to carry `barcode: null` while the agent's carries the real one;
- cancel refused once the bags are out; fail refused without a reason;
- transitions refused out of order and for invented codes;
- cross-tenant access returns **404**, not 403;
- the seeded board proven to hold a claimable job.

Six more call the validator and operator **directly**, with no database and no HTTP — the same
purity check the booking guards get, and the only way to reach a branch that depends on the
clock: an expired code refused with a perfect scan, the same scan accepted while it is alive,
the stranded courier's way out, `TO_RELEASE_APPROVED` proven to exclude couriers *in the data*,
the operator proven not to mutate the snapshot it was handed, and the bag statuses the host must
apply.

**Multi-kiosk — 49 API checks (`npm run test:multikiosk`) and a browser spec of its own.** The API
pass walks the whole run: the lookup of what the customer holds elsewhere, one delivery covering
three kiosks, a second delivery for the same bags refused, the courier's sub-task list, and then
kiosk by kiosk — a stranger refused the release, another customer's barcode refused, the bags
collected, the task rolled on to the next kiosk with the spent code cleared — then the hand-over
refused while money is owed, a short payment refused, the full amount taken, the hand-over
allowed, and every booking on the run closed. The browser spec drives the same journey through
three signed-in sessions at once: two kiosks and the courier.

**Browser — 9 specs, all passing**, driving two real sessions in parallel browser contexts:
courier workspace isolation, raising a request from the console, the phoned-in gate, the full
two-session handover (claim → release with the ID check → scan → deliver → booking closed with
its custody trail), a wrong barcode refused at the kiosk, an **expired code** (aged on the wire
rather than waited out) offering the way back and hiding the scan panel, a second courier locked
out of a claimed job, and the manager offering the courier role.

---

## 8. Not built (deliberately)

- **Courier pay / settlement.** `fee` is carried on the request and shown, but nothing settles it.
- **Live location or route guidance.** The task shows an address and a tap-to-call number.
- **Proof of delivery capture** (signature or photo). The state change is recorded; the evidence
  is not. This is the first thing I would add next.
- **Reassigning a job between couriers.** A courier gives it up with a reason and it returns to
  the board.
- **Automatic dispatch.** Jobs are claimed, not assigned — which is what "like Glovo" means.
