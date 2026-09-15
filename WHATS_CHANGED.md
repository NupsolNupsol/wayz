# WAYZ — what changed, for testing

Everything that changed from the requirements document (roles, kiosks, rules) through the
testing round, grouped so the client can work through it screen by screen.

---

## 1. Who works here

The role list was rebuilt around the requirements document.

| Role | Scope | What it covers |
|---|---|---|
| Kiosk agent | one desk | Sells, takes the money, hands over, takes back — on a Shop & Drop, Mobility or Lagoon desk. The cashier seat no longer exists — the agent *is* the cashier, and the invoice's "الكاشير" line carries their name. |
| Chief captain | one lagoon desk | Same counter, lagoon only, plus dispatch. |
| Supervisor | one activity | Oversees the floor. Reads tills and shifts, settles variances, force-closes a forgotten till. Does not set prices or rules. |
| Manager | one activity | Everything the supervisor has, plus staff, pricing, the operating rules, and releasing refunds. |
| Project manager | tenant-wide | The manager's remit across every activity, with sub-managers under them. |
| HR | tenant-wide | People, costs and seasons — the expense manager and inventory keeper roles folded in here. |
| Delivery agent | tenant-wide | Carries bags to customers. |
| Accountant | tenant-wide | Reports, VAT, reconciliation, commissions. Deliberately **cannot** release refunds. |
| CEO (tenant admin) | tenant-wide | The company record, the rules, the estate, and everything above. |

Removed as agreed: COTE Restaurant, offline mode, IT manager, chief accountant, external
integrations, shared multi-cashier accounts, and the roles beneath the accountant.

**Scope is taken from the signed-in session, never from the request.** A desk sees its own desk's
work; an activity role sees their activity; a tenant role sees the tenant. This is enforced in
one place in the API rather than page by page.

---

## 2. Kiosks for all three activities

- Sites → stations → **kiosks**, each with a type (Shop & Drop, Mobility, Lagoon).
- Every desk, asset and booking belongs to a kiosk; the till and the day's takings are per desk.
- Kiosks can be created, renamed, re-typed and deleted. One holding assets or live bookings
  refuses deletion until they are moved, and says what is in the way.

---

## 3. Assets and products (§2.2)

- Assets carry unit, sale type, deposit, price, penalty price and replacement value per asset.
- Products are priced per activity, per station, by duration or per item.
- The estate page shows every unit: its desk, its state, its live booking, its history.
- At handover the agent chooses the numbered unit from what is actually free at that desk.

---

## 4. The operating rules are the tenant's (§8.1, §2.3)

One page, editable by the CEO **and the activity manager** — no redeploy, no code:

- grace period, and the grace the customer is *told* about (which cannot exceed the real one)
- overtime block size and hourly charge
- minutes given back when a faulty unit is replaced
- the wrong-desk return penalty
- when each activity's clock starts: bag storage on handover; rentals on payment + 5 minutes
- the whole penalty schedule, each line either a flat amount or "the asset's own value"

---

## 5. Money

- **Overtime** charges in whole blocks: a minute past the grace is a full hour. It shows while
  the vehicle is still out, and is collected through the ordinary payment path.
- **Extensions** are agent-driven, priced by the hour from the session's own end time.
- **Penalties** — wrong-desk returns and the §2.3 schedule — land on the same order.
- All three reach the till, the day's takings, the VAT position, the card reconciliation and the
  accountant's ledger exactly like a first sale, carrying the activity and the desk.
- **Refunds need approval** from the activity manager, the project manager or the CEO. A desk
  asks; nothing moves until it is released; nobody releases their own request. Cash goes back out
  of the drawer it came into. Reversing a single till transaction answers to the same people.
- **Commission by card scheme** (mada, SPAN, Visa, Mastercard, GCC) is recorded as a bank expense,
  never as tax.

---

## 6. The till and the shift

- A counter does **no business** — no sale, no extension, no settlement — until its till is open.
- The header carries an **Open till** button for desk staff only, with the opening float. The
  float is counted in as a movement, so the drawer balances from the first minute.
- Closing a till means counting it on the shift page; a variance goes to the floor leads.
- A shift now records **which desk** it belonged to, alongside the station.
- A supervisor or manager can open any shift, see what moved through it, settle a variance with
  a note, or **force-close** a till the agent went home without closing by counting the drawer.
  It is closed in their name, and the record says so.

---

## 7. The counter's day

- **Operations board**: live, self-refreshing, with the due amount, when each session started,
  how long the customer has been with us, and filters on all of it.
- **Sign-out** is confirmed, and a desk is told what it is walking away from.
- **Extend** and **Replace** are counter actions on any live session.
- **Wrong-desk returns**: scan the vehicle; if it is another desk's, the screen says whose,
  shows the live booking, and offers **Calculate penalty**. The booking and the vehicle then
  belong to the desk holding them, so that desk can finish the job.
- **Nothing is handed over unpaid** — bags, vehicles and boats all refuse an unpaid booking.
- **An unfinished sale reopens where it stopped**, in the flow that was creating it.

---

## 8. The invoice

- One document, matching the client's printed sales invoice: seller, CR and VAT numbers, branch,
  desk, the agent's name on the "الكاشير" line, the lines, how it was paid, base + VAT, barcode.
- The public tracking QR is printed on it — the separate "download invoice" is gone.
- Prints at 80 mm for the SUNMI roll.
- Sent to the customer's WhatsApp as a PDF automatically on payment. Where the API has no public
  address the message still goes, with the invoice link, and says the attachment could not.

---

## 9. Notifications

- Delivered by desk, by activity and by audience, with per-person read state.
- The separate page is gone: the bell is the only place, and clicking a notice opens the thing it
  is about.

---

## 10. Removed or folded in

- The **Employees** page — folded into Accounts & roles.
- The **Notifications** page — folded into the header bell.
- **Split payment** at the point of sale.
- The **Download invoice** button — one invoice, with the QR on it.
- The `/cashier` workspace — the desk carries the till.

---

## 11. Money that arrives after the sale

- **Extend** is a counter button on the booking, beside "send to customer". Extensions
  accumulate — a second one adds to the first rather than replacing it.
- Everything a session earns after it started — extension, overtime block, wrong-gate penalty,
  delivery charge — lands on the same order and shows as **one amount owed**, on the booking and
  on the operations board.
- **Take payment** on the booking opens the register's own payment modal and collects it, so it
  reaches the till, the takings, the VAT position and the card reconciliation like any sale.
- A **delivery can carry a charge**, entered when the request is raised.
- The **delivery agent collects at the door**: their task screen shows the total owed and takes
  it by card or cash. Cash requires their own open drawer and lands in it, while the sale stays
  attributed to the desk that made it.
- **Nothing is handed over unpaid**, and **an unfinished sale reopens where it stopped**.

---

## 12. The lagoon, split in two

| Who | What they do |
|---|---|
| Lagoon agent | Sells trips and takes the money. The system fills the boats. |
| Chief captain | Sails. No point of sale, no till, no drawer — a task-runner, like the courier. |

- **Boats & trips** (the desk): everyone who has paid and is waiting, grouped by the boat they
  asked for, with the headcount and the boats it will take. One click splits them into trips —
  by boat type, then into loads that fit the seats — and each becomes a task.
- **My trips** (the captain): take a trip, cast off (a real boat is put under it and the
  passengers are dispatched), **clock each station reached** to build the route, then finish —
  which closes every passenger's booking and frees the boat. It refuses to finish while a
  passenger still owes money.

---

## 13. Extensions removed; payment before anything goes back

- The extension flow is gone entirely.
- The customer comes back, the booking shows the overtime, the desk takes it, and only then can
  the bags come out or the vehicle be signed in. Retrieval and completion are blocked while
  anything is outstanding — including on the boat, and including at the door, where the courier
  sees the overtime and the delivery charge as one total.

---

## 14. Mobility priced by the hour or by the tour

- A product carries an hourly price, a tour price, and the length of a tour. The manager, HR or
  the CEO set either or both — pricing moved to its own place so HR can reach it without being
  given the rest of the manager's workspace.
- The counter picks which, types the number, and sees the price before anything is created.

---

## 15. HR: the roster, the hours, and the people log

- A tenant-wide **shift window** (15:00 → 01:00 by default, understood as a ten-hour night
  shift), editable by HR.
- **Hours worked per person**, counted from when a till was opened to when it was closed, next
  to what the roster expected.
- A **people log**: sign-ins, sign-outs, tills opened, tills force-closed, variances settled,
  roster changes — filterable by person and by kind.

---

## 16. Bags at more than one kiosk, brought back in one run

A customer who shopped all day may have left bags at two or three kiosks. They ring one desk and
ask for the lot.

- The agent opens **Send to customer**. The modal looks the customer up across the station and
  lists everywhere their bags are sitting — kiosk, compartment, how many bags, the reference —
  with a tick per kiosk and a **Bring everything** tick.
- One delivery is created with **one stop per kiosk**, the desk that took the call first.
- The courier's task is a list of **sub-tasks**: where to go now, what is queued, what is
  collected. Each one is the usual drill — ask that kiosk's agent for the compartment code, open
  it, scan the bags blind — and finishing a kiosk sends them to the next, with the old code
  cleared so nothing can be reused.
- The kiosk board names the kiosk the courier is standing at, and marks whether it is yours.
- At the door the courier takes **one payment for the whole run** — the delivery charge plus
  anything owed on any of the bookings. The bags cannot be handed over until it is paid. Every
  booking on the run is then closed and every compartment freed.

**To try it:** sign in at a kiosk, open a stored booking for a customer who also has bags
elsewhere (the demo data has one), press *Send to customer*, tick *Bring everything*, set a
charge, and follow the courier through each kiosk in a second browser.

---

## 17. The venue on a map, and a boat that sails it

**For the CEO — Station map.** A new section under Estate. The venue is drawn as a canvas, and
every station and every desk the company has created can be dragged onto it and dropped where it
actually stands. Markers are coloured and shaped by what they are — station, lagoon jetty, bag
desk, vehicle gate — anything not placed yet waits in a tray on the right, and a marker can be
taken back off at any time. Positions are saved on the tenant, so everybody reads the same map.

**For the captain — Chart & sail.** A new section in the lagoon workspace. The captain sees the
same map, taps the jetties in the order they intend to sail them, and the road is drawn across
the water with the order numbered on each marker. Then:

- **Cast off** puts a real boat under the trip and the boat appears on the chart at the jetty it
  is leaving from.
- **Reached Egypt** clocks that jetty; the boat glides across the map to it, the leg is ticked
  off with the time, and the button moves on to the next jetty on the road.
- When the last jetty is clocked, the trip can be finished — which closes every passenger's
  booking and frees the boat.

A jetty that has already been reached cannot be taken off the road, and a road can only be laid
over places that exist in the company. The demo venue arrives already laid out, so the map is not
a blank page on the first visit.

---

## 18. Release notes anyone can read — `/versions`

A public page, no sign-in needed, at **`/versions`**.

- The list is one row per release we cut: the version, the date, what is in it, the areas it
  touched, and how many changes it carries. It is searchable.
- Opening a release shows every change with the area, who it is for, what changed, **numbered
  steps to test it** — including which account to sign in as — **what you should see**, and
  **buttons that take you straight to the screen** in question.
- Two ways in: a **What's new** button on the sign-in screen, and a rocket icon in the header for
  anyone already signed in.
- Releases are stored, not hard-coded, so a new one is added when you say the word (and the CEO
  can manage them through the API).
- **Each change can be checked off.** A tester presses *Mark as checked*, types their name once
  (the browser remembers it), and the card shows "Checked by …" — so nobody wastes time testing
  the same thing twice. The release list shows the progress, e.g. **3/8 checked**.
- **Anything broken can be reported on the spot.** *Report an issue* takes a name and a
  description; every report stays listed under that change, with who wrote it and when, and the
  release list shows how many reports are still open.

---

## 19. The invoice shows the penalty

Overtime, wrong-desk penalties and the delivery charge are tagged on the printed slip and in the
PDF (**OVERTIME**, **PENALTY**, *delivery*), and taking that money now sends the customer a fresh
invoice — not only the first sale does.

---

## 20. The lagoon: the desk seats, the boat fills, the captain sails

- **A lagoon sale names the boat.** The desk sees every boat at that desk with the seats left on
  each — the roomiest first, so a boat fills quickly — and seats the party on the one they pick.
- **The visitor count is bound by that boat.** You cannot type 40 people onto an eight-seat abra;
  the box stops at the seats left, and a sale with no boat chosen is refused outright.
- **A full boat calls a captain by itself.** No grouping button, no dispatcher: when the last seat
  is sold, that boat becomes a task on the captain's board. Until then, no captain is called.
- **A half-full boat can still go** — *Send it now* on the trips page releases it to the captains.
- **The desk cannot start a trip, at all.** Not from the trips page, not from the sale, not from
  the booking: the API refuses it for anyone but the captain.
- The trips page is now a live board of the boats at the desk: how full each is, what is waiting
  for a captain, and what is out on the water.

---

## 21. The captain's workspace, shaped like the courier's

- The captain no longer sees a counter. Their menu is **Trip board · Chart & sail · Completed ·
  Profile** — no bookings, no operations, no assets, no incidents — and signing in lands them on
  their trip board.
- A trip reads like a courier's task: **the boat and its seats, and the manifest** — who is
  aboard, with the booking reference and headcount.
- **Only the captain starts a trip.** The lagoon desk takes the money; the system fills the boats
  by boat type and seats, first paid first aboard.
- On the chart, **stations not on the road are dimmed**; the ones the captain picks light up and
  carry their order number, the path is drawn between them in that order, and the boat sits on the
  map and moves to each jetty as it is clocked.
- Fixed: the captain's dashboard used to load forever — they were being refused the figures it
  asked for.

---

## 22. Two things the client asked for while testing this round

- **Welcoming staff is gone.** It was a second name for a lagoon agent, so the role was removed
  everywhere — a lagoon desk is simply an agent on a lagoon kiosk. Huda's account still works and
  still sells at the Mountain jetty; she is an agent now.
- **The captain plans the road before the boat leaves.** Casting off is refused, in the API and on
  the screen, until the jetties have been picked and saved. The lagoon desk cannot start a trip at
  all — it takes the money, the system fills the boats by seats in the order people paid, and the
  captain takes it from there.
- **The captain's dashboard stopped offering things a captain cannot do** — no Shop & Drop, no
  Mobility, no customers. The quick actions now follow the role.

---

## 23. Smaller things

- The **new customer** button sits on the left, above the search field, as a button.
- The manager's **occupancy report** uses the platform's sortable, filterable table.
- The **booking page** lists what is charged: every line, VAT, the total, paid, outstanding.
- **Begin retrieval / complete / return** are now visibly disabled while money is owed, with the
  reason and a *Take payment* button right there — the API always refused, now the screen says so
  before the click.
- **Notices open the page you actually have**: the desk opens the booking it works from, a
  manager opens it in their workspace, a captain's notice opens the trip. No more "Page not
  found".
- **A booking is always reserved into a compartment at your own kiosk**, never one at another
  desk you cannot open. If your desk is genuinely out of that size, the message says so by name —
  which desk, which size, what **is** free there — instead of a flat refusal.
- **One Take payment button**, inside the Actions card next to what is owed. The duplicate in the
  page header is gone, and the payment window no longer opens by itself when a charge appears.
- **Nothing is paid or released before the customer is checked.** Take payment is disabled until
  the identity check passes, and a check is spent as soon as the customer runs into more time —
  if they left and came back, they are verified again.
- **The bookings list carries a Price column**, sortable and filterable, with what is still owing
  underneath.
- **The set-your-password page** (the link a new employee gets by email) now looks like the rest
  of the platform, in both languages.
- **A courier does nothing on a job they have not picked up.** The *Pick up this task* button now
  sits at the top of the task, and until it is pressed the courier cannot ask a kiosk for bags or
  take a single riyal — the API refuses it, not just the screen.
- **Couriers are told when a delivery is raised**, and the **kiosk agent is told when a courier is
  standing at their desk** asking for a compartment code — that notice opens the release dialog
  straight away.
- **The duplicate "Board" button** is gone from the courier task; the back arrow next to the title
  is the one way back, the same as everywhere else.
- **Less text on every page.** The client found the platform heavy to read: each page carried a
  breadcrumb line above the title and a sentence of description below it. Both are gone
  everywhere — a page now shows its title, the back arrow and its actions, and nothing else at the
  top. Nothing was lost: anything that mattered (the customer on a booking, the customer and bag
  count on a delivery) is on the page itself.
- **Refund approvals** no longer hides its status filter in a box pretending to be a statistic.
  It is a segmented control beside the page title — All / Pending / Approved / Rejected — and the
  duplicate filter inside the table is gone.


---

## 24. Discount codes — batches of tickets, redeemed at any desk

The CEO opens **My company → Discount codes** and presses **New batch**: a name, how many codes,
the percentage, an optional expiry date, and which activities the code works on (none picked means
all of them). The platform mints that many unique codes — a short prefix, a dash, then six
characters drawn from an alphabet with no `O`, `I`, `0` or `1`, because someone reads these off
paper in a hurry.

The batch page lists the codes and exports them as a CSV to print or hand to a partner. Each row
shows whether the code is unused, spent (with the booking it paid for) or stopped.

At the counter, the agent presses **Discount code** on the payment step, types the code, and the
batch's percentage comes off the sale. The platform checks, in order: is it ours, is it unused,
is it in date, is the batch still live, and does it cover this activity. Anything else is refused
with a sentence saying which.

A code is spent exactly once — two desks racing on the same code end with one discount and one
refusal. **Stop unused codes** on a batch kills every code still out there and leaves the spent
ones on the record, so the money already given away stays auditable.

The redemption is a discount line on the order like any other, under the reason `Discount code`,
with the batch name and the code in the note — so it flows into the revenue reports, the invoice
and the audit trail without a special case.

**Why a batch of real codes rather than one code with a counter:** every ticket is individually
traceable. When the client asks who used the SELA codes and where, the answer is a row per code
with the desk, the agent, the booking and the amount taken off.

---

## 25. Smaller things in this round

- **The receipt prints itself** after a payment, and the slip was re-cut for the roll — the
  workspace no longer takes part in the print, which is what caused the long blank tail.
  Switchable per company (`settings.autoPrintReceipt`).
- **A finished session stops counting.** The serialiser now returns where the clock stopped, and
  every timer on every screen reads it, so a completed rental can never show a live overtime.
  Cancelling a session stops its clock too.
- **Typed amounts hold their bounds.** `NumberInput` clamped on blur; it clamps as you type now.
  That covers the split-payment amount, the discount percentage and the seats on a boat.
- **Soft deletes reached the screens.** Sites, stations and people have delete buttons matching
  the desks, with the guards on the API behind them.
- **Venue types are free text**, tidied into house style, and every one used joins the list.


---

## 26. The follow-ups of 8 September

- **Bags go to an exit gate.** A bag drop is paid for at the desk that takes the bags, and — if the
  customer is late — at the gate where they collect. The desk picks Gate 1 or Gate 2 rather than
  typing an address; the courier only carries the bags there; the gate's agent checks the customer,
  takes any overtime and hands the bags over. Which desks count as exit gates is set on the estate
  page.
- **Releasing bags is one confirmation.** The agent confirms the courier in front of them and hands
  the bags over in a single step, stamped with their name and the time.
- **Free rides and discounts are a tick box** on the Mobility and Lagoon counters, with a reason that
  cannot be skipped. Everything given away is summed on the manager dashboard and listed under
  **Reports → Free rides & discounts**, by reason and by agent, with a CSV export. The reasons and
  their ceilings are edited in **Operating rules**.
- **Incidents** are unchanged, at your direction: they close the operation, take the asset out of
  service, and stay visible in the reports.
