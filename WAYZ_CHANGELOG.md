# WAYZ — everything that changed

From the requirements document that redrew the roles, through the client's testing notes, to the
lagoon captain and the shift roster. Written for someone who has to test the platform or explain
it, not for someone reading the code.

---

## 1. Who works here, and what each of them can touch

The role list was rebuilt around the client's requirements document.

| Role | Sees | Does |
|---|---|---|
| **Kiosk agent** | one desk | Sells, takes the money, hands over, takes back — on a Shop & Drop, Mobility or Lagoon desk. The cashier seat is gone — the agent *is* the cashier, and the invoice's الكاشير line carries their name. |
| **Chief captain** (lagoon) | one lagoon desk | Sails. No point of sale, no till, no drawer — a task-runner, like the courier. |
| **Supervisor** | one activity | Oversees the floor. Reads tills and shifts, settles a variance, force-closes a forgotten till. Sets no prices and no rules. |
| **Manager** | one activity | Everything the supervisor has, plus staff, pricing, the operating rules, and releasing refunds. |
| **Project manager** | the tenant | The manager's remit across every activity, with sub-managers under them. |
| **HR** | the tenant | People, costs, seasons, the shift roster, hours worked, the people log, and pricing. |
| **Delivery agent** | the tenant | Carries bags, and takes payment at the door. |
| **Accountant** | the tenant | Reports, VAT, reconciliation, commissions. Deliberately **cannot** release refunds. |
| **CEO** (tenant admin) | the tenant | The company record, the rules, the estate, and everything above. |

Dropped as agreed: COTE Restaurant, offline mode, IT manager, chief accountant, external
integrations, shared multi-cashier accounts, and the roles beneath the accountant.

### Scope is taken from the session, never from the request

Three levels — **desk**, **activity**, **tenant** — resolved from the signed-in token in one
place in the API. A desk sees its own desk's work; an activity role sees their activity; a
tenant role sees the tenant. No screen decides this for itself, and no request can widen it.

---

## 2. Kiosks, for all three activities

- Sites → stations → **kiosks**, each typed (Shop & Drop, Mobility, Lagoon).
- Every person, asset, booking, payment and till belongs to a kiosk.
- Kiosks can be created, renamed, re-typed and deleted; one still holding assets or live
  bookings refuses deletion and says what is in the way.

---

## 3. Assets and products

- Assets carry unit, sale type, deposit, price, penalty price and replacement value — per asset,
  per §2.2 of the brief.
- The estate page shows every unit with its desk, its state, its live booking and its history; a
  unit can be moved between desks by hand.
- At handover the agent **picks the numbered vehicle** from what is actually free at that desk,
  so the number on the vehicle matches the number on the booking.
- Products are priced per activity and per station, by duration, per item, **or by the tour**.

---

## 4. The operating rules belong to the tenant

One page, editable by the CEO **and the activity manager** — no redeploy, no code:

- grace period, and the grace the customer is *told* about (which cannot exceed the real one)
- overtime block size and hourly charge
- minutes given back when a faulty unit is replaced
- the wrong-desk return penalty
- when each activity's clock starts — bag storage on handover, rentals on payment + 5 minutes
- the whole §2.3 penalty schedule, each line either a flat amount or "the asset's own value"

---

## 5. Money

**Overtime** charges in whole blocks: a minute past the grace is a full hour, two hours and a
minute is three. It is visible while the vehicle is still out, on the booking and on the
operations board, and it is collected through the ordinary payment path.

**Penalties** — the wrong-desk return and the §2.3 schedule — land on the same order.

**Delivery** can carry a charge, entered when the request is raised, joining the same total.

All of it reaches the desk's till, the day's takings, the VAT position, the card reconciliation
and the accountant's ledger exactly like a first sale, carrying the activity and the desk.

**Refunds need approval** from the activity manager, the project manager or the CEO — never the
accountant, who reports on the numbers they would be signing off. A desk asks and nothing moves;
nobody releases their own request; the cash goes back out of the drawer it came into even when
the manager releasing it is nowhere near a till. Reversing a single till transaction answers to
the same people, so there is no second door out of the drawer.

**Commission by card scheme** (mada, SPAN, Visa, Mastercard, GCC) is recorded as a bank expense,
never as tax.

---

## 6. The till and the shift

- A counter does **no business** — no sale, no settlement — until its till is open.
- The header carries an **Open till** button for the people who actually have a drawer (the
  desks and the courier), with the opening float counted in as a movement so the drawer balances
  from the first minute.
- Closing a till means counting it on the shift page; a variance goes to the floor leads.
- A shift records **which desk** it belonged to, not just which station.
- A supervisor or manager can open any shift, see what moved through it, settle a variance with
  a note, or **force-close** a till the agent went home without closing — counted, and recorded
  in the lead's name.
- HR sets the **shift window** (15:00 → 01:00 by default, understood as a ten-hour night shift)
  and reads **hours worked per person** against it.

---

## 7. The counter's day

- **Operations board**: live and self-refreshing (15 seconds, and it opens on fresh data rather
  than a cached copy), with what each customer owes right now, when their session started, how
  long they have been with us, and filters and sorting on all of it.
- **Signing out** is confirmed for every role, and a desk is told what it is walking away from —
  how many sessions are running and how much is still to collect.
- **Replace** swaps a faulty unit for a working one against a recorded reason, and gives the
  customer back the minutes the swap cost them.
- **Wrong-desk returns** are caught automatically: the agent scans the vehicle, and if it belongs
  to another desk the screen says whose, shows the live booking, and offers **Calculate penalty**
  at the figure the tenant admin or the activity manager set. The booking and the vehicle then
  belong to the desk holding them, so that desk can finish the job.
- **Nothing is handed over unpaid**: bags cannot be stored, vehicles cannot be handed over and
  boats cannot be dispatched against an unpaid booking.
- **Nothing goes back unpaid either**: retrieval, completion and signing a vehicle back in are
  refused while anything is outstanding. The desk sees the figure, takes it, and the step goes
  through.
- **An unfinished sale reopens where it stopped** — clicking a draft takes the agent back into
  the flow that was creating it, at the step it stopped on, instead of a half-filled record page.
- **The booking says what it charged**: every line, VAT, the total, what has been paid, and what
  is still outstanding.
- **A testing clock** ages one booking's session (30/60/120 minutes, or a number you type, and
  it rewinds) so an overtime rule can be seen to fire without waiting for it. Testing builds
  only, and every use is audited.

---

## 8. Extensions: removed

The extension flow is gone — from the workflow engine, the API, the screens and the tests. What
replaced it is simpler and is what the client asked for: the customer comes back, the booking
shows what the overtime comes to, the agent takes the payment, and only then do the bags or the
vehicle go back. The same total follows a delivery, so the courier at the door collects the
overtime and the delivery charge together.

---

## 9. The lagoon: the agent sells, the captain sails

**The desk** has a **Boats & trips** page: everyone who has paid and is waiting, grouped by the
boat they asked for, with the headcount and how many boats it will take. One click splits them
into trips — by boat type first, then into loads that fit that boat's seats — and each trip
becomes a task. A party larger than one boat is seated across two, with nobody left standing and
no boat overloaded.

**The captain** has their own board: the trips waiting, one tap to take one, cast off (which puts
a real boat under it and dispatches the passengers), then **clock each station as they reach it**,
building the route stop by stop. Finishing the trip closes every passenger's booking and frees
the boat — and it refuses to finish while a passenger still owes money.

The captain is not a cashier: no point of sale, no till, no drawer, no selling workspace — by the
menu, by typing the address, or through the API.

---

## 10. Delivery

- The request carries a **delivery charge**, entered by the agent raising it.
- The courier's task screen shows **one total** — the delivery charge plus anything the customer
  ran up while their bags were out — and takes it at the door by card or cash.
- Cash needs the courier's own drawer open and lands in it, while the sale stays attributed to
  the desk that made it, so the reports read correctly and the courier's drawer reconciles
  against what they actually carry.
- **The bags may be at more than one kiosk.** A customer who shopped all day can have left bags
  at Iran in the morning and Morocco in the afternoon. When they ring one desk and ask for
  everything back, that desk raises **one delivery** covering every kiosk:

  1. The agent opens *Send to customer*. The modal asks the database what else that customer is
     holding across the station and lists it — kiosk, compartment, how many bags, the reference —
     with a tick per kiosk and a **Bring everything** tick for the lot.
  2. The delivery is created with **one stop per kiosk**, the desk that took the call first.
  3. The courier's task shows the stops as **sub-tasks**: which kiosk to go to now, which are
     queued, which are done. Each stop is the same drill as a single-kiosk job — ask *that*
     kiosk's agent for the compartment code, open it, scan the bags blind — and finishing one
     rolls the task straight on to the next kiosk, with the spent code cleared.
  4. The kiosk deliveries board names the kiosk the courier is standing at and marks whether it
     is yours, so an agent at Levant is not confused by a courier collecting at Morocco.
  5. At the door the courier collects **the whole run in one payment** — the delivery charge plus
     anything owed on any of the bookings — and only then can they hand the bags over. Every
     booking on the run is closed and every compartment freed.

---

## 10b. The venue on a map

- **Stations and desks carry a position.** The CEO opens **Estate → Station map** and drags every
  station and desk onto a branded canvas of the venue. Markers are coloured and shaped by what
  they are; anything unplaced waits in a tray and can be dragged on or taken back off. Positions
  live on the tenant, so every screen reads the same map. Only the CEO can redraw it; a floor
  manager is refused.
- **The captain sails that map.** **Chart & sail** shows the same canvas. The captain taps the
  jetties in the order they will sail — the road is drawn and numbered — then casts off, and the
  boat appears at the jetty it leaves from. Clocking a jetty moves the boat across the water to
  it, records the time, and points the next-stop button at the following jetty. The last jetty
  clocked, the trip can be closed.
- **Guards:** a road can only be laid over places that exist in the company; a stop already
  reached cannot be dropped from the road; the same jetty cannot be clocked twice in a row.

---

## 11. The invoice

- One document, matching the client's printed sales invoice: seller, CR and VAT numbers, branch,
  desk, the agent's name on the الكاشير line, the lines, how it was paid, base + VAT, barcode.
- The public tracking QR is printed on it — the separate "download invoice" is gone.
- It prints at 80 mm for the SUNMI roll, black on white, no browser furniture.
- It goes to the customer's WhatsApp as a PDF automatically the moment the sale is paid.
- Where the API has no publicly reachable address, the message still goes — as text with the
  invoice link — and says plainly that the attachment could not. See `WHATSAPP_INVOICE.md`.

---

## 11b. Less on the page

The client found the platform text-heavy. Every page carried a breadcrumb line above its title and
a sentence of description below it; both are now gone, in one place — the shared page header — so
every page built after this inherits the same restraint. A page leads with its title, the back
arrow, and its actions. Where a description carried something operationally useful, that detail
moved into the page body rather than being dropped.

---

## 11c. Release notes as part of the product — `/versions`

- A **public page** (no authentication, rate-limited like the tracking page) listing every release
  as a row: number, date, summary, the areas it touched, how many changes it carries — searchable.
- A release opens into its changes. Each one carries the area, the roles it affects, what changed,
  **numbered steps to test it** naming the account to sign in as, **what you should see**, and
  **deep links** into the screens involved.
- **Two ways in:** a *What's new* button on the sign-in screen, and a rocket icon in the header.
- **Testing is tracked on the page itself.** Each change carries a *Mark as checked* button — the
  tester types their name once and the card records "Checked by …", so the same thing is not
  tested twice — and a *Report an issue* button that takes a name and a description. Every report
  stays listed under its change with who wrote it and when, and the release list shows both the
  progress (`3/8 checked`) and how many reports are still open.
- Releases are a collection (`Version`), not a hard-coded file: `GET /api/public/versions` and
  `/api/public/versions/:id` read them, `POST /api/public/versions/:id/changes/:index/check` and
  `.../issue` record a check or a report (public, rate-limited, name and text capped), and the CEO
  can `POST`, `PATCH` or `DELETE` at `/api/admin/versions`. Two releases ship with the seed, the
  newest describing this work with its own test steps.

---

## 11d. The invoice carries the penalty

Overtime, wrong-desk penalties and the delivery charge are marked on the slip and the PDF
(**OVERTIME**, **PENALTY**, *delivery*) rather than reading as another product line, and settling
that money sends the customer an updated invoice — previously only the first sale did.

---

## 11g. The lagoon, rebuilt around the boat

- **A lagoon sale names the boat instance.** `GET /lagoon/trips/boats` lists every boat at the
  desk with seats, seats taken and seats free, ordered by the most room first. Creating the
  booking requires `unitId`, and refuses a party larger than the seats left.
- **The seat count is authority, not decoration.** The visitor box is capped by that boat's free
  seats, and the API refuses anything over it — a 40-person party can no longer be typed onto an
  eight-seat abra.
- **A boat that fills becomes a task by itself.** Each paid party is seated onto a trip for that
  boat (status `FILLING`). When the headcount reaches the seats, the trip flips to `READY` and the
  captains are notified. There is no grouping button any more; `POST /lagoon/trips/plan` is gone.
- **A half-full boat can be released early** by the desk: `POST /lagoon/trips/:id/release`.
- **Starting a trip is captain-only, everywhere.** `TO_STARTED` and `TO_COMPLETED` on the lagoon
  workflow now list the captain and floor leads; the agent is refused at the API, and the fulfil
  step is gone from the lagoon sale.
- The desk's trips page is a live board: each boat's fill level, what is waiting for a captain, and
  what is out on the water.

---

## 11f. The captain is a task worker, not a counter

- The captain's workspace was rebuilt to the courier's shape: **Trip board, Chart & sail,
  Completed, Profile**, landing on the trip board. Bookings, operations, assets and incidents are
  gone from it.
- A trip carries **the boat, its seats and the manifest** — every party aboard with its reference
  and headcount.
- **Starting a trip is the captain's alone**; the lagoon desk sells and the system fills the boats
  by type and seats, first paid first aboard.
- On the chart, stations off the road are **dimmed**; picked ones carry their order number, the
  path is drawn in that order, and the boat moves node to node as each is clocked.
- **Defect fixed:** `/dashboard/stats` refused the chief captain, so their dashboard spun forever.
  Desk staff now covers the captain, and the page no longer spins when a figure cannot be read.
- **Deployment note:** the tracking link in WhatsApp reminders comes from `PUBLIC_APP_URL`. The API
  now warns at startup when that address does not answer, instead of sending customers a dead link.

---

## 11e. Two corrections to the shape of the platform

- **The welcoming-staff role is gone.** It duplicated the lagoon agent, so it was removed from the
  role list, the permission tables, the workflow package, the seed, the navigation and both
  languages. A lagoon desk is an agent on a lagoon kiosk. The seeded account keeps working, as an
  agent.
- **A boat does not leave without a planned road.** The lagoon desk cannot start a trip; grouping
  into boats is automatic — by boat type, then by seats, in the order people paid. The captain
  claims a trip, plans the road on the chart, saves it, and only then can cast off: refused by the
  API and disabled on screen until a road exists.
- **Quick actions follow the role.** The captain's dashboard no longer offers Shop & Drop, Mobility
  or the customer list.

---

## 12. Notifications

Delivered by desk, by activity and by audience, with per-person read state. The separate page is
gone: the bell is the only place, and clicking a notice opens the thing it is about.

---

## 13. HR

- Costs and seasons as before (the expense manager and inventory keeper roles folded in here).
- **Shifts & hours**: the shift window, hours worked per person against what the roster expected,
  tills still open, and last seen.
- **A people log**: sign-ins, sign-outs, tills opened, tills force-closed, variances settled and
  roster changes — filterable by person and by kind.
- **Pricing**: HR can price what the floor sells, alongside the manager and the CEO, without
  being given the rest of the manager's workspace.

---

## 14. Removed, or folded into something else

| Gone | Where it went |
|---|---|
| The **Employees** page | Folded into Accounts & roles, which could already edit |
| The **Notifications** page | Folded into the header bell, where a notice opens the thing it is about |
| **Split payment** at the point of sale | One method for the whole amount; card is the default |
| The **Download invoice** button | One invoice, with the tracking QR on it |
| The **/cashier** workspace | The desk carries the till |
| The **extension** flow | Overtime, paid when the customer comes back |
| The **COTE Restaurant** activity, offline mode, IT manager, chief accountant, integrations | Out of scope, as agreed |

---

## 14b. Defects found while testing, and fixed

- **A route guard that fell open.** Every workspace is guarded by role. The guard waited while
  the session was being identified, but if that check *failed* — which happens under load — it
  fell through and rendered the page for whoever was asking. The API still refused the data, so
  nothing leaked, but HR could land on the manager's workspace and stay there. It now
  default-denies: no identified role means no page, and a session that cannot identify itself is
  sent back to sign in. The identity check also retries before giving up.

- **Cash refunded from the wrong drawer.** A manager releasing a desk's refund took the cash out
  of their own till — which they do not have — instead of the drawer the money went into. The
  refund now comes out of the shift that took it, or that desk's open till, so the day still
  reconciles where the cash physically moved.

- **A booking reserved into a compartment the desk could not see.** When a desk created a
  booking, the compartment was picked from everything free at the *station* rather than at the
  desk's own kiosk, so a booking could be reserved into a locker at another kiosk and then show
  no compartment at all on the page that made it. Reservation is now scoped to the kiosk the
  agent is signed in at, and the page falls back to reading the unit directly if a booking ever
  points at one outside the desk's list.

- **Notifications that led to a dead page.** A notice about a booking pointed at an address that
  does not exist for the person reading it, so clicking it landed on "Page not found". Each
  notice now resolves to the page the *reader* actually has — the desk opens the booking it works
  from, oversight opens it in the manager's workspace, a captain's trip notice opens the trip —
  and a notice with nowhere to go for that role does not pretend to be a link.

- **The payment window opened by itself.** It was wired to open whenever the amount owed changed
  rather than only when the agent pressed the button, so a new overtime charge popped it open
  unprompted. It now opens once per press.

- **An identity check that outlived the visit.** A check stayed valid for its full half hour even
  if the customer ran into another charged hour in the meantime — which in real life means they
  left and came back. Any new overtime charge now spends the check, in the API as well as on
  screen, so they are verified again before anything is handed over. Payment is held behind the
  same check.

- **A desk that had run out of a size said only "cannot reserve".** Now it names the desk and the
  size, lists what is free at that desk, and says how many of that size are free elsewhere. The
  demo data also ships every desk with headroom in every size.

- **A courier could act on a task nobody had picked up.** Opening a task by its address let a
  courier take payment on it — and ask a kiosk for the bags — without ever claiming it. Both are
  now refused in the API until the task is assigned, and the *Pick up this task* button has moved
  to the top of the page.

- **A party split across two boats stranded the second one.** A group too big for one boat is
  split across two; closing the first boat closed the passengers' booking, so the second boat
  could never cast off. Boarding now skips anyone already aboard, and a booking is only closed
  once no other boat is still carrying it.

- **A seeded booking that looked paid off.** The demo's ninety days of takings were all filed
  against the first booking's order, which made that booking read as massively overpaid and hid
  what was owed on it. The history now carries its own references, so balances on the demo data
  are true.

---

## 15. What is tested, and how to run it

### The API pass — 404 checks, eight suites

```bash
cd backend && npm test
```

| Suite | Checks | Covers |
|---|---|---|
| `roles` | 102 | Every role's reach: what each one may open, and what each one is refused |
| `rules` | 21 | The tenant's operating rules, the clock, the wrong-desk charge |
| `clientNotes` | 101 | Every point from the client's testing notes, end to end |
| `shift` | 29 | The drawer: opening float, no business without a till, forced closes |
| `lagoon` | 33 | Seating parties on a boat, the boat filling, the task raised when it is full, the captain's road and stops, completion |
| `hr` | 24 | The roster, hours worked, the people log, pricing |
| `map` | 31 | The station map, the captain's road and boat, and a courier held back until they pick a task up |
| `multiKiosk` | 62 | A customer's bags at three kiosks: the lookup, one delivery, the sub-tasks kiosk by kiosk, payment at the door, every booking closed — and a customer who leaves and comes back being checked again |

The pass is idempotent — everything it borrows, it hands back — so it can be run twice in a row
and gives the same answer.

### The browser pass — the whole platform, driven as an operator

```bash
cd frontend && npm run build && npx playwright test
```

Around 185 tests across 23 files, run serially against the built app and the real API: the three
activity journeys, the till, accounting and commissions, HR, the manager's workspace, refunds and
approvals, deliveries — including a full multi-kiosk run driven kiosk by kiosk in three separate
browser sessions — the lagoon trips, Arabic and RTL, the client's notes one by one, and a
responsive pass at phone and tablet widths — plus the station map, the captain's chart, and the
public release-notes page.

### Before either

The stack has to be up and seeded:

```bash
cd backend
docker compose up -d
docker compose exec api npm run seed
```

---

## 16. Deployment notes

| Variable | Why it matters |
|---|---|
| `PUBLIC_API_URL` | Where the API answers from on the internet. WhatsApp fetches the invoice PDF from here; without it the message goes as text. See `WHATSAPP_INVOICE.md`. |
| `PUBLIC_APP_URL` | Where the customer's tracking page lives — printed on the invoice as a QR code. |
| `VONAGE_API_KEY` / `VONAGE_API_SECRET` / `VONAGE_WHATSAPP_NUMBER` | The WhatsApp sender. On the sandbox, recipients must be whitelisted. |
| `DEMO_TIME_TRAVEL` | Turns the testing clock on. Leave it off in production. |
| `DEMO_SCANNER` | Reveals barcodes to the courier for testing. Off in production. |

---


---

## 17. Where to read more

- `CLIENT_TESTING_NOTES_RESPONSE.md` — the client's notes, answered one by one.
- `WHATS_CHANGED.md` — the same ground as this document, shorter, for handing to the client.
- `WHATSAPP_INVOICE.md` — how the PDF reaches the customer, and how to test it once deployed.
- `ROLES.md`, `TILL.md`, `TRANSACTIONS.md`, `ACCOUNTANT.md`, `HR.md`, `ASSETS.md`,
  `MANAGER_WORKSPACE.md`, `DELIVERY_AGENT.md` — the per-area guides.

## 18. Discount codes

`backend/src/models/voucher.model.ts` holds two collections: a **campaign** (the batch: name,
percentage, quantity, activities, expiry, who created it, whether it is still live) and the
**vouchers** it minted (code, percentage, activities, expiry, status, and — once spent — when, by
whom, at which desk and against which booking).

`voucher.service.ts` mints in chunks of 500, from a 32-character alphabet with the ambiguous
glyphs removed, and guarantees uniqueness within the batch before it writes. `MAX_BATCH` caps a
single press at 5000.

Redemption reuses the discount plumbing rather than inventing a second path: `redeemVoucher`
validates the code, calls `discountBooking` with a **system reason** (`VOUCHER`, ceiling 100) that
is deliberately not in the tenant's own reason list — so a desk cannot pick it by hand — and only
then marks the code spent, with a conditional update on `status: 'ISSUED'` so two desks racing on
one code cannot both win.

Routes: `GET|POST /admin/vouchers`, `GET /admin/vouchers/:id/codes`, `POST /admin/vouchers/:id/stop`
(minting and stopping are CEO-only; reading is back-office), and `POST /bookings/:id/voucher` for
the desk.

---

## 19. The clock, and where it stops

`sessionEndedAt()` in `services/serializers.ts` answers one question: where did this session's
clock stop? It is `session.chargeableEndedAt` when the workflow recorded one; for a booking that
is finished but has no recorded end — an older row, or one closed by a path that predates the
field — it falls back to when the booking last changed. `bookingDTO` computes the overtime against
that instead of "now" and publishes it as `session.endedAt`, so every screen showing a timer
inherits the stopped value without each one deciding for itself.

`cancelRelease` in the workflow package now stamps the same field, so a cancelled session cannot
run up overtime either.

> **Note when editing this:** `computeOvertime` is handed the session's fields by name. Spreading a
> mongoose subdocument (`{ ...booking.session }`) silently drops its schema paths, which reads as
> "every booking shows no timer and owes nothing".


---

## 20. The counter's own state, and what counts as a confirmation

**A half-finished sale lives in the tab.** `features/bookings/workspaceDraft.ts` holds the small
read/write pair both counters use; each writes a snapshot on every meaningful change and reads it
back on mount, rebuilding the booking and order from the API rather than trusting stale numbers. The
keys are distinct (`wayz.workspace.<engine>` for the engine counter, `wayz.workspace.shopdrop-counter`
for the bag counter) so neither can read the other's shape. A paid sale clears its own draft.

**A confirmation is a proof, and proofs are written where they are made.** `rememberPhoneVerified`
takes whatever destination the code went to — a phone or an email — and stamps `phoneVerifiedAt` on
the customer matched by phone tail *or* by email. Recording only the phone route meant an
email-verified customer was refused at payment while the screen showed them as verified.

`PHONE_PROOF_TTL_MIN` now travels to the client on `me.tenant.phoneProofTtlMin`, and `OtpBox` flips
itself back to unverified a minute before the proof lapses — the screen and the server agree on what
is still true.

---

## 21. The seed is re-runnable

`Incident` and `VerificationEvidence` were not in the wipe, so a second `npm run seed` left their
rows behind while `Counter` reset — and the next incident died on `E11000 duplicate key inc-0003`.
Both are wiped now. Seeding twice in a row leaves a consistent database.

The seed also carries this round's demo data: two live discount-code batches, Arabic names on the
catalogue, and release five of the notes. `npm run seed:versions` still seeds the release notes on
their own, for deploying without touching the rest.


---

## 22. Bags to a gate, and what the delivery model is now

A Shop & Drop booking is charged at the desk that takes the bags in, and — if the customer is late —
at the exit gate where they collect. Nothing is charged for the move between them.

`Kiosk.isExitGate` marks a desk as an exit. `GET /deliveries/exit-gates` lists the ones at this
site, and a delivery raised with `toKioskId` gets `destination.kind = 'GATE'` with the gate's id and
name. Anything raised with a written `address` behaves as before.

The difference lands in `applyBookingEffects`. On `TO_DELIVERED`:

- **to an address** — the booking completes, custody `PORTER → CUSTOMER`, as before;
- **to a gate** — the booking *stays open* in `RETRIEVAL_IN_PROGRESS`, its `kioskId` moves to the
  gate, and custody goes `PORTER → AGENT` with a note naming the gate. The customer has not been
  served yet; the gate's agent checks them, takes any overtime and closes it.

Because a gate may sell something else entirely (Gate 1 is a mobility desk), the booking scope has
one deliberate widening: **a booking sitting at your kiosk is yours to handle, whatever its
activity**. Everything else still filters by activity, so a lagoon agent still sees only lagoon work
at other desks.

The release handshake was collapsed to one step: `TO_RELEASE_APPROVED` now accepts `ASSIGNED` as a
source, so the desk can hand the bags over without the courier requesting first. The courier's
`TO_RELEASE_REQUESTED` remains as an optional "I am here" that notifies the desk.

---

## 23. Discounts as a record, not a log line

`booking.discount` holds the amount, the percentage, the reason code and label, the note, the
voucher code where one was used, whether it was a free ride, and who gave it when. Written by
`discountBooking`, which is the single path for both hand-typed discounts and redeemed codes.

That makes the reporting exact rather than parsed:

- `GET /manager/reports/discounts` — totals, free-ride count, breakdowns by reason, by agent and by
  activity, a daily series, and every row;
- `GET /manager/reports/export/discounts` — the same as CSV;
- `managerOverview` carries today's and the last 30 days' totals for the dashboard card.

The reasons themselves live on the tenant (`discountReasons`) and are edited in **Operating rules**,
where each carries the most it may take off. The desk cannot give anything away without picking one.

---

## 24. The staff choose a language; the customer is always written to in Arabic

The header toggle sets the *agent's* screen. Nothing addressed to a customer reads it, because the
customer never made that choice.

**One file holds the copy.** `backend/src/constants/messages.constants.ts` carries every outbound
message — the WhatsApp code, the OTP email, the invoice message, the "your time is nearly up"
warning, the staff invitation, the Arabic role names, and the invoice line names. The `otp`,
`email`, `invoice` and `overtime` services import from it and hold no English of their own. Both
email templates now render `lang="ar" dir="rtl"` with the code and any URL pinned `dir="ltr"`.

**The slip prints Arabic from an English screen.** `InvoiceSlip` takes `i18n.getFixedT('ar', …)`
rather than the live language, and sets `dir="rtl"` on itself. An agent working in English hands the
customer an Arabic invoice.

**Line names are baked bilingual.** An order line now carries `nameAr` beside `name`. The English one
is what the agent sees on the payment panel and in the ledger; the Arabic one is what prints:

| Line | Staff screen | Customer's slip |
|---|---|---|
| A bag drop | `Bag Size S (2 bags)` | `حقيبة مقاس S (2 حقائب)` — from the product's own `nameAr` |
| A deposit | `Refundable Deposit` | `تأمين مسترد` |
| A discount | `Discount — Employee` | `خصم — موظف` |
| Overtime | `Overtime — 3 × 1h blocks` | `وقت إضافي — 3 ساعات` |

Discount reasons gained an optional `labelAr`, edited in **Operating rules** beside the English one,
because the reason is printed on the customer's copy. Empty falls back to the English wording.

**What is deliberately left alone:** the registered legal name, the branch, the desk and the
cashier's name print as the company record holds them — a tax invoice should carry the registered
name, and a person's name is not ours to transliterate. Adding Arabic names for those means adding
the fields to the company, station and staff records.

**Bidi:** every Latin value sitting inside an Arabic line carries `dir="auto"`, and codes and URLs
carry `dir="ltr"`. Without it a trailing full stop moves to the front of the line.
