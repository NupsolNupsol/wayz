# WAYZ — response to the testing notes

Every point raised in the testing round, with what was changed and where to see it.

---

## HIGH priority

### 1. Customer registration accepted one digit of a phone number
**Fixed.** A customer record is only accepted with a full name and a real phone number
(Saudi `05XXXXXXXX` / `+9665XXXXXXXX`, or an international number of at least nine digits).
The same rule runs in the API and in the screen, so a partial record cannot be created from
either side, and a booking cannot be taken to payment against an incomplete customer — the
payment step stays locked and says which detail is missing.

### 2. Invoice printing did not fit the SUNMI roll; PDF to the customer
**Fixed.** The invoice prints at 80 mm roll width, black on white, with no browser headers, so
it comes out of the SUNMI printer as a receipt rather than an A4 page. The same invoice goes to
the customer's WhatsApp as a PDF, automatically, the moment the sale is paid — nobody has to
remember a button.

*On the demo machine:* WhatsApp fetches the PDF from a public address. On a laptop with no
public address the message still goes, with the invoice link in it, and the platform says so
plainly. Set `PUBLIC_API_URL` to a reachable address (a tunnel in testing, the real host in
production) and the PDF attaches itself.

### 3. No logout confirmation; agents not warned about live work
**Fixed.** Every role is asked to confirm before signing out. A desk is additionally told what
it is walking away from — how many sessions are running, and how much is still to collect —
before the sign-out goes through.

### 4. Due amount not visible in active operations
**Fixed.** The operations board has a **Due** column showing what each customer owes right now,
including overtime still accruing on a session that has not been handed back yet. The booking
itself carries the same figure with a **Collect it** action beside it.

### 5. Extend / Replace asset buttons missing
**Fixed, and done the way you asked.** Both are counter actions, not public buttons: the
customer contacts the agent, exactly like a delivery request.

- **Extend** — on any live session, in any activity. Extra time is charged by the hour, added
  from the session's own end time (not from now), priced by the tenant's rules, and billed onto
  the same invoice.
- **Replace** — swaps a faulty unit for a working one against a recorded reason, and gives the
  customer back the minutes the swap cost them.

---

## MEDIUM priority

### 6. Timestamp column in active operations, with filtering
**Fixed.** The board shows when each session started and how long the customer has been with
us, and it can be filtered by age (under 30 minutes, 30 minutes – 2 hours, 2–6 hours, over 6
hours) as well as sorted.

### 7. Live auto-refresh of operations and asset availability
**Fixed.** The operations board and the asset lists refresh themselves every 15 seconds and
open on live data rather than on a cached copy. A small indicator shows the last refresh, so
two agents at one counter are looking at the same thing.

### 8. Customer email missing in the Customers tab
**Fixed.** Email is captured on creation, shown on the customer record and on the list, and is
used as the fallback channel for identity checks when WhatsApp cannot be reached.

### 9. Card should be selected by default at payment
**Fixed.** The payment panel opens on **Card** with the card schemes ready. Cash is one tap
away. The split-payment control was removed entirely — it was the confusing part.

### 10. UI overwhelming — simplify and organise
**Fixed.** Two pages that said the same thing twice were removed (Employees, folded into
Accounts & roles; and the Notifications page, folded into the header bell, where clicking a
notice opens the thing it is about). The payment step asks one question instead of five, and
the invoice is one document instead of two.

---

## LOWER priority

### 11. Go-back button
**Fixed.** Every workspace page carries a back control, and the multi-step flows let the agent
step back to any earlier stage. Stepping back from payment releases the unpaid draft and the
held capacity, so nothing is left hanging.

### 12. Complete logs / overview
**Fixed.** The audit trail records users and role changes, every booking action, sign-ins and
sign-outs, refund requests and decisions, till openings and closings, rule changes, and use of
the testing clock. It is filterable by action, by person and by date, and the manager has a
matching activity log for their own activity.

### 13. Developer accelerated time counter for testing
**Fixed.** A **Testing clock** panel on any live booking moves that booking's session forward by
30, 60 or 120 minutes, or by a number you type (it also rewinds). It does not fake the system
clock: it ages that one session, so the overtime rule, the penalty and the badges all behave for
real. It is only present outside production, and every use is recorded in the audit trail.

---

## Other necessities and fails encountered

### 1. Overtime hourly charge did not add up
**Fixed.** One minute past the grace period is a full hour, and every further hour is another
full hour — charged in whole blocks at the tenant's hourly rate. The grace period, the block
size, and the grace the customer is *told* about are all tenant settings. The figure is visible
while the vehicle is still out, and collecting it goes through the ordinary payment path, so it
reaches the till, the day's takings, the VAT position and the card reconciliation.

### 2. Fleet management underdeveloped
**Fixed.** At handover the agent picks the numbered vehicle from the list of what is actually
free at that desk, so the number on the vehicle matches the number on the booking. The estate
page shows every unit with its desk, its state and its live booking, and a unit can be moved
between desks by hand when it needs to be.

### 3. Auto penalty detection for gate changes on Mobility returns
**Fixed, exactly as described.** The agent scans the vehicle's QR code. If it belongs to that
desk, the return proceeds. If it belongs to another desk, the screen says **this vehicle belongs
to Gate N**, shows the live booking on it, and offers **Calculate penalty** — the figure comes
from the rules that the tenant admin *and the activity manager* control. The charge lands on the
booking, is collected through the normal payment path, and reaches accounting and reconciliation
like any other sale. The booking and the vehicle then belong to the desk holding them, so that
desk can finish the job.

### 4. Refund policy needs approval
**Fixed, with the approver you asked for: admin/manager, not the accountant.** A desk asks for a
refund and nothing moves; the request goes to the activity manager, the project manager or the
CEO, who releases or refuses it with a note. Nobody releases their own request. The money goes
back out of the drawer it came into, even when the manager releasing it is nowhere near a till.
The same rule covers reversing a single till transaction — there is no second door out of the
drawer.

### 5. Sites and gates not flexible
**Fixed.** Sites, stations and kiosks can be created, renamed, re-typed and deleted. A kiosk
holding assets or live bookings cannot be deleted until those are moved — the refusal says what
is in the way.

---

## Raised during this round, and fixed

- **Till discipline.** A counter cannot sell, extend or settle anything until its till is open.
  The header carries an **Open till** button (desk staff only) with the opening float; closing a
  till means counting it on the shift page. A supervisor or manager can force-close a till the
  agent went home without closing, by counting what is in the drawer — recorded in their name,
  with the variance raised to the floor leads.
- **Nothing is handed over unpaid.** Bags cannot be stored, vehicles cannot be handed over and
  boats cannot be dispatched against an unpaid booking. This closed a real gap where an agent
  could skip the payment step and still complete the job.
- **An unfinished sale reopens where it stopped.** Clicking a draft booking takes the agent back
  into the flow that was creating it, at the step it stopped on, instead of a half-filled record
  page.
- **The booking shows what is charged** — every line, VAT, the total, what has been paid and what
  is still outstanding.
- **The manager's occupancy report** is the same sortable, filterable table used everywhere else
  in the platform.

### Extensions, penalties and delivery — one amount, taken once

- **Extend** is a button on the booking beside "Send to customer", not a step hidden in the
  workflow list. Extensions accumulate: a second one adds to the first.
- Whatever the customer owes — the extension, the overtime block, a wrong-gate penalty, the
  delivery charge — adds up to **one figure**, shown on the booking and on the operations board,
  with a **Take payment** button that opens the same payment modal used at the register.
- A **delivery can be charged for**: the agent enters the charge when they raise the request, and
  it joins the same total.
- The **delivery agent takes payment at the door**. Their task screen shows what is owed and
  takes it by card or cash; cash needs their own drawer open, and lands in it. The sale still
  belongs to the desk that made it, so the reports read correctly and the courier's drawer
  reconciles against what they actually carry.

---

## Second round of notes

### HR sees more, and sets the roster
HR now has a **Shifts & hours** page: the shift window (the client's 15:00 → 01:00, which the
platform understands as a ten-hour night shift), **hours actually worked per person** against
what the roster expected, and a **people log** — sign-ins, sign-outs, tills opened, tills closed
by a lead, roster changes — filterable by person and by kind. The CEO sees it too; nobody else.

### The new-customer button
It sits **above** the search field now, where an agent looks for it.

### Mobility priced by the hour or by the tour
A mobility product carries an **hourly price**, a **tour price**, and how long a tour runs — the
manager, **HR** or the CEO fill either or both on the pricing page, which HR now reaches from
their own menu. At the counter the agent picks
**By the hour** or **By the tour**, types the number, and the price is calculated in front of
them before anything is created. A product with no tour price refuses to be sold as one.

### Nothing is handed back while money is owed
A booking cannot reach **retrieved** or **completed** — bags out, vehicle signed in, boat
finished — while anything is outstanding. The desk sees the figure, takes the payment, and the
step then goes through. This also closed the gap you spotted where a payment stage could be
skipped entirely.

### Extensions are gone
Removed, exactly as asked. The customer simply comes back: the booking shows what the overtime
comes to, the agent takes it, and only then do the bags or the vehicle go back. The same figure
follows a delivery — the courier sees the overtime **and** the delivery charge as one total.

### The lagoon: the agent sells, the captain sails
- The **lagoon agent** takes bookings and payments as before, and has a new **Boats & trips**
  page: everyone who has paid and is waiting, grouped by the boat they asked for, with the
  headcount and how many boats it will take. One click splits them into trips — by boat type
  first, then into loads that fit that boat's seats — and each trip becomes a task.
- The **captain** is not a cashier: no point of sale, no till, no drawer, no selling workspace —
  by the menu or by typing the address. Their board shows the trips waiting, they take one, cast
  off (which puts a real boat under it and dispatches the passengers), and then **clock each
  station as they reach it**, building the route stop by stop. Finishing the trip closes every
  passenger's booking and frees the boat — and it refuses to close while a passenger still owes
  money.

---

## Third round of notes

### A booking registered without a compartment
**Fixed, and it was a real defect.** The compartment was chosen from everything free at the
*station* rather than at the desk's own kiosk, so a booking could be reserved into a locker at
another kiosk — which the desk that made it then could not see or open. Reservation is now scoped
to the kiosk the agent is signed in at, and the booking page falls back to reading the unit
directly if a booking ever points at one outside that desk's list. There is an API check for it,
so it cannot come back quietly.

### A notification that led to "Page not found"
**Fixed.** The notice pointed at an address that does not exist for the person reading it. Each
notice now resolves to the page the *reader* actually has: the desk opens the booking it works
from, a manager or the CEO opens it in the manager's workspace, a captain's trip notice opens the
trip. A notice with nowhere to go for that role is shown as text rather than pretending to be a
link. A browser test now opens **every** notice each role can see and fails if any of them lands
on a dead page.

### Begin retrieval, while a penalty is unpaid
**Fixed.** The API always refused it; now the screen says so first. The button is visibly
disabled, a line above it names the amount, and a **Take payment** button sits right there. Once
the money is in, the button enables itself.

### The customer's bags are at several kiosks
**Built.** A customer who shopped all day may have left bags at two or three kiosks and rings one
desk asking for the lot:

- **Send to customer** now looks the customer up across the station and lists everywhere their
  bags are — kiosk, compartment, how many bags, the reference — with a tick per kiosk and a
  **Bring everything** tick.
- One delivery is created carrying **one stop per kiosk**, the desk that took the call first.
- The courier's task becomes a list of **sub-tasks**. Each is the usual drill — ask *that*
  kiosk's agent for the compartment code, open it, scan the bags blind — and finishing one sends
  them to the next kiosk with the old code cleared, so a code can never be carried across.
- The kiosk board names the kiosk the courier is standing at and marks whether it is yours.
- At the door the courier takes **one payment for the whole run** — the delivery charge plus
  anything owed on any of the bookings — and the bags cannot be handed over until it is settled.
  Every booking on the run is then closed and every compartment freed.

The demo data ships a customer whose bags sit at three different kiosks, so the case can be
walked through without setting anything up. It is covered by 49 API checks and a browser test
that drives two kiosks and the courier at the same time.

### The invoice links looked like plain text
Nothing is wrong with the message: WhatsApp turns a URL into a tap-able link itself, and each
link is already on its own line. What it will not linkify is `http://localhost:...`, because
there is nowhere for a phone to go. Pointed at the deployed HTTPS domain, both links are tappable
and the invoice arrives as an attachment rather than a link at all. `WHATSAPP_INVOICE.md` covers
it.

---

## Fourth round of notes

### "Take payment" appeared twice
**Fixed.** The button in the page header is gone. Payment is taken from one place — inside the
Actions card, next to the line that says what is owed and why the hand-over is blocked.

### Payment before the customer is checked
**Fixed.** On a booking that needs an identity check, *Take payment* is disabled until the
customer is verified — both the button in the Actions card and the one on the amount-owed card.
The order at the counter is now the real-world one: check who they are, take the money, hand the
bags back.

### The payment window opening by itself
**Fixed, and it was a genuine bug.** The window was told to open whenever the amount owed
changed, not only when the agent pressed the button — so an overtime charge appearing (for
example after the demo clock jumped) popped it open on its own. It now opens once per press and
never on its own.

### A customer who leaves and comes back must be checked again
**Fixed.** An identity check is spent the moment the customer runs into more time. In practice:
they were verified, they wandered off, another hour was charged — the earlier check no longer
counts, and the screen says so ("the customer has run into more time since they were verified").
They must be verified again before anything is released. Enforced in the API, not just on screen.

### The price on the bookings list
**Added.** The bookings table now carries a **Price** column — the total charged, sortable and
filterable like every other column, with what is still owing underneath it in amber.

### The set-your-password page did not look like the platform
**Rebuilt.** It now uses the same two-panel design as the sign-in page — brand panel with the
mark on one side, the form on the other, the same input heights, the same buttons — and it is
fully translated (English and Arabic) rather than carrying hard-coded English.

### "Cannot reserve compartment"
**Fixed, two ways.**
1. *Why it happened:* reservations are now correctly limited to the desk's own kiosk (a desk
   cannot lock a locker it cannot open). That desk had genuinely run out of medium compartments,
   and the message did not say so.
2. *What we changed:* the message now names the desk and the size — "Iran has no Bag Size M free
   right now", with what **is** free at that desk and how many of that size exist at other desks.
   And the demo data now ships every desk with real headroom in every size, so the case only
   shows up when a kiosk is genuinely full.

---

## Fifth round of notes

### The venue on a map, and the boat that sails it
**Built, both halves.**

- **CEO → Estate → Station map.** A branded canvas of the venue. Every station and desk that has
  been created can be dragged onto it and dropped where it really stands; anything not placed
  waits in a tray beside the map and can be dragged on (or taken back off) at any time. Markers
  are coloured and shaped by what they are — station, lagoon jetty, bag desk, vehicle gate. The
  positions are saved on the company, so every screen reads the same map. The demo venue ships
  already laid out.
- **Captain → Chart & sail.** The captain opens the same map, taps the jetties in the order they
  will sail, and the road is drawn across the water with each stop numbered. Casting off puts a
  boat on the chart at the jetty it leaves from; clocking a jetty glides the boat across to it,
  ticks that leg off with the time, and points the button at the next one. When the last jetty is
  clocked the trip can be finished. A stop already reached cannot be taken off the road.

### The delivery agent could act on a task they had not taken
**Fixed.** Payment and the compartment request are both refused by the API until the courier has
picked the task up — not merely hidden on screen. The **Pick up this task** button has moved to
the top of the task page, where it is the first thing they see.

### Nobody was told
**Fixed.** Raising a delivery notifies the couriers; a courier asking for a compartment code
notifies that kiosk's agent, and opening that notice takes them straight into the release dialog
with the courier's name on it.

### The extra "Board" button
**Removed.** The back arrow beside the page title is the single way back, on every page and every
role.

### A party split across two boats
**Fixed while testing this.** A group too big for one boat is split across two — and closing the
first boat was closing the whole booking, so the second boat could never cast off. A booking is
now only closed when no other boat is still carrying it, and boarding skips anyone already
aboard.

### The platform reads as too heavy
**Fixed across every page.** Each screen carried three lines of text before its content: a
breadcrumb, the title, and a sentence of description. The breadcrumb and the description are gone
everywhere — one change in the shared page header, so it holds for pages built later too. Each
page now leads with its title, the back arrow, and its buttons. Where a subtitle carried something
useful (the customer on a delivery task) that detail moved into the page itself rather than being
dropped.

### The status filter on Refund approvals
**Fixed.** It was a dropdown in a box that looked like a third statistic. It is now a segmented
control next to the page title — All / Pending / Approved / Rejected — which scrolls rather than
wraps on a phone, and the second, competing filter inside the table has been removed.

### A page that tells the team what changed and how to test it
**Built, public, at `/versions`.** Each release is a row — version, date, summary, areas, number of
changes — and opening one lists every change with the area, who it is for, numbered steps naming
the account to sign in as, what you should see, and buttons that jump straight to the screen. A
*What's new* button sits on the sign-in screen and a rocket icon in the header. Releases are
stored records, so the next one is added the moment you say the word.

Each change can also be **checked off** by whoever tested it — they type their name once and the
card shows "Checked by …", so two people never test the same thing — and **anything broken can be
reported there and then**: the report is kept under that change with the reporter's name and the
time, and the release list shows the progress (`3/8 checked`) and how many reports are still open.

### An invoice that shows the penalty
**Done.** Overtime, wrong-desk penalties and the delivery charge are tagged on the printed slip and
the PDF, and taking that money sends the customer a fresh invoice rather than leaving them with the
original one.

### Welcoming staff was redundant
**Removed.** It was a lagoon agent under another name. The role is gone from the platform — a
lagoon desk is an agent on a lagoon kiosk, with the counter narrowed to the lagoon exactly as
before. The seeded account (`welcome.wayz@lockerflow.demo`) still works and still sells at the
Mountain jetty, as an agent.

### The captain must choose the road before the boat leaves
**Done.** The lagoon desk cannot start a trip at all; it takes the money and the system fills the
boats by boat type and seats, first paid first aboard. The captain picks a trip, taps the jetties
on the map in the order they will sail, saves the road, and only then can cast off — refused in the
API and disabled on the screen until a road exists. Clocking a jetty moves the boat to that node on
the map.

### The captain's dashboard offered him a shop
**Fixed.** Quick actions now follow the role: the captain sees his chart and the assets he needs,
not Shop & Drop, Mobility or the customer list.

### The captain was being shown a shop
**Rebuilt as a task workspace, like the courier's.** The captain's menu is now Trip board, Chart &
sail, Completed and Profile — nothing else — and they land on their trip board when they sign in.
A trip shows the boat, its seats and the manifest of who is aboard. Only the captain can start a
trip; the lagoon desk takes the money and the system fills the boats by seats, in the order people
paid. On the chart, stations that are not on the road are dimmed, the chosen ones carry their order
number with the path drawn between them, and the boat moves to each jetty as it is clocked.

Also fixed while there: the captain's dashboard loaded forever because the figures it asked for
were refused to that role.

### The tracking link in the WhatsApp reminder is dead
**Not a platform bug — a deployment setting.** The message builds the link from `PUBLIC_APP_URL`,
and the deployed environment has it set to `https://mallgo.nupsol.com`, which is not serving the
web app. Point that domain at the built front end (`frontend/dist`), or set `PUBLIC_APP_URL` to the
address that does serve it. The API now logs a loud warning on startup when that address does not
answer, so this cannot go unnoticed again.

### The agent could still start a trip, and could type any number of visitors
**Both fixed, and the lagoon works the way you described it now.**

- **The sale names the boat.** After choosing the product the desk sees every boat at that desk
  with the seats left on each, roomiest first. The party is seated on the boat the agent picks.
- **The number of visitors is bound by that boat** — the box will not go past the seats left, and
  a lagoon sale with no boat chosen is refused.
- **A full boat becomes a captain's task on its own.** There is no grouping button any more: seats
  fill as you sell, the boat reads Empty → Filling → Full, and only when it is full does the task
  appear on the captain's board. A boat that will not fill can be sent early with *Send it now*.
- **The desk cannot start a trip anywhere.** The API refuses it for every role but the captain —
  from the trips page, from the sale, and from the booking itself.
- The captain then claims the task, sees the boat, its seats and who is aboard, picks the stations
  on the map, and sails: the road is drawn in the order chosen, unpicked stations stay dimmed, and
  the boat moves to each jetty as the captain clocks it.


---

# The 8 September review — every point, and what it does now

The twenty-four points from the client's list of 08/09/2026, in the order they were raised.
Everything below is on the demo and was tested end to end before this note was written.

## Mobility

**1. A booking could be paid for without a vehicle behind it.**
A mobility sale now names the vehicle before it can be paid. If nothing is free at that desk the
sale says so, and names the desks in the station that do have one, instead of failing at payment.

**2. The countdown kept running after the vehicle came back.**
The clock stops where the session stops. A returned or completed rental shows its remaining time
greyed and stopped, and it never moves again — on the booking, the dashboard, the operations
board and the workspace list, all reading the same stopped value.

**3. Overtime charged, then charged again on the way out.**
Overtime is one running figure on the booking. Once the counter takes it, it is settled: the
handover no longer re-charges what was already paid.

**4. The vehicle stayed rentable after damage was reported.**
Reporting an incident on a live rental closes the session and puts the unit into maintenance in
one step. It leaves the pool immediately and comes back only when a lead resolves the report.

**5. Nothing stopped a second rental on a vehicle already out.**
A unit that is occupied, reserved or in maintenance cannot be sold again. The picker only offers
what is genuinely free at that desk.

**6. Prices needed to be per hour *and* per tour.**
Both live on the product. The desk chooses hours or tours at the point of sale and the quote
follows; the invoice says which was used.

**7. Product names did not read in Arabic.**
A product carries its Arabic name and an icon. The Arabic counter shows the Arabic name, and so
does the printed invoice.

## Shop & Drop

**8. A bag could be stored without a compartment.**
Storing requires a compartment, scanned. There is no path to a stored bag without one.

**9. The customer had to be checked again after coming back into overtime.**
A new overtime charge spends the old identity check. The desk has to confirm the customer again
before the bags come out — which is exactly what happens in life: they left, and they came back.

**10. Compartment sizes and counts did not match the site.**
Sizes and counts are configuration, not code: the estate page sets how many of each size sit at
each desk.

**11. A delivery could be raised while money was owed.**
It cannot. The desk takes the money first — on the booking that took the call *and* on every
other kiosk joining the run. The courier has no payment screen at all, and there is no delivery
fee.

## Lagoon

**12. The desk could start a trip, and could type any number of visitors.**
The desk sells; it never sails. The sale names the exact boat, roomiest first, with the seats
left on each. The visitor box is bound to those seats and will not go past them — typed or
tapped. A boat that fills becomes a captain's task on its own; the captain plans the road and
sails it.

## System configuration

**13. Rules and ceilings were hard-coded.**
The operating rules page holds the grace period, the overtime block, the expiry warning, the
penalty schedule and the discount reasons with their ceilings. Changing any of them is a settings
change, not a release.

**14. Penalties needed to appear on the invoice.**
A penalty or an overtime charge is a line on the invoice, named, so the customer can see what
they are paying for.

**15. Stations could not be deleted, and venue types were a fixed list.**
Sites, stations, desks and people all have a delete button now — and every delete is soft: the
record stops appearing, its history stays whole. A site with stations, a station with desks,
assets, staff or live sessions, and a person with an open till are refused with a plain reason.
Venue types are no longer a fixed list: type your own and it joins the list.

**16. Kiosks needed to move between activities.**
A desk belongs to one activity and can be re-pointed; an agent moved to a desk in another
activity gets that activity's workspace, menu and till.

**17. Users could not be removed.**
They can, softly — see 15. Their bookings, shifts and audit trail stay readable everywhere they
appeared.

**18. Discounts and free rides had no controls.**
The desk takes a percentage off, or makes a sale free, but only for a reason on the company list
and only up to that reason's ceiling. Every one is on the audit trail with who gave it and why.

**19. The receipt had to print itself, and printed badly.**
It prints itself the moment a payment goes through — the company can turn that off in settings.
The slip was re-cut for the roll: the workspace no longer takes part in the print, so the long
blank tail after the total is gone and the slip sits square at 80 mm.

**20. One sale, two payment methods.**
Tick *Split it*: part in cash, the rest on the card. Both land on the same sale, the drawer only
counts the cash half, and the card half carries its scheme.

**21. Every money movement had to reach the drawer.**
No transaction runs without an open till, and every cash movement updates the expected cash on
that shift.

**22. Products needed to be placed where they are actually sold.**
A product belongs to an activity and appears at the desks running it.

**23. Product icons.**
Set per product, shown on the counter tile.

## HR

**24. HR needed more of the audit.**
The people log carries sign-ins and sign-outs, tills opened and force-closed, variances resolved,
the roster window being moved, invitations, cash floats, pay-outs and drops — filterable by person
and by action.

## Also in this round, at the client's suggestion

**Discount codes, printed in batches.**
The CEO creates a batch: a name, how many codes, the percentage, an optional expiry, and which
activities it works on. The platform mints that many unique codes — six characters after a
prefix, with no letters that read like digits — and they can be exported as a CSV to print. A
customer reads one out at any desk, the agent types it in, and the percentage comes off the sale.

A code works exactly once, and the record shows which booking it paid for, at which desk, by
which agent. A batch can be stopped: every unused code dies, the spent ones stay on the record.
Expiry and activity limits are per batch, so a lagoon-only summer code cannot be spent on a
scooter in December.

**No typed amount can exceed what is owed.**
Number fields that decide money — the split amount, the discount percentage, the visitors on a
boat — used to clamp only when you clicked away, so an impossible figure could be typed and
quoted from. They hold their bounds as you type now.


---

## The counter, re-tested end to end (8 September, later the same day)

Four more findings from testing the counter as an agent, rather than through the API alone.

**A half-finished sale on the bag counter is kept.** Shop & Drop lost everything if the agent tapped
another menu item mid-sale — the customer, the bags, the plan, the quote. The Mobility and Lagoon
counters already kept theirs; the bag counter does now too. Coming back shows the sale where it was
left, with a line saying so and a button to start a new one instead.

**A code answered by email now counts as a confirmation.** The confirmation box lets the desk send
the code by WhatsApp or by email. A code answered by *email* was never written down as proof, so the
box turned green and the payment was then refused with "Confirm the customer before taking their
money" — with the customer standing there. Both routes are recorded now.

**The green tick expires when the confirmation does.** A confirmation is only good for half an hour.
The tick used to stay green past that, so the agent pressed Confirm payment and was refused. It now
returns to asking for a code a minute before the proof lapses.

**The discount code box reached the bag counter.** It was on the Mobility and Lagoon counters and at
the till, but not on Shop & Drop, so a customer's code could not be taken there.

### Discounts in the books

Checked end to end rather than assumed. A discount is a real line on the order — not a hidden
adjustment — so:

- the till's expected cash rises by the **discounted** amount, never the list price;
- the accountant's ledger and the till transaction carry that same figure;
- the list price cannot be charged after a discount is applied;
- the redemption is on the audit trail with who gave it, against which booking, at which desk.


---

## The follow-ups of 8 September (afternoon)

Four more points came back the same day. All four are in, and each is covered by a check in
`npm run test:points`.

### Incidents (point 5)

Left as it is, at the client's direction: an incident closes the operation and takes the asset out
of service, and the incident stays visible to the floor and in the reports. Flagging the operation
instead of closing it was raised and deferred — incidents are rare, and the urgent items came first.

### Shop & Drop is charged in two places, and bags go to a gate (points 8 & 10)

The money now happens exactly where the client described:

1. **At the desk that takes the bags in.** The agent charges for the stay.
2. **At the exit gate, if the customer is late.** They collect from the agent at the gate, who takes
   any overtime there.

Between those two, the bags are moved. When the desk sends them out it now picks **an exit gate**
rather than typing an address, and the courier's only job is to carry them there. When the courier
marks the run delivered, the bags are **not** handed to the customer — they are handed to that
gate's agent. The booking leaves the desk that took it in, appears at the gate, and stays open until
the customer turns up, is checked, pays anything owed, and takes their bags.

A desk becomes an exit gate by being marked as one on the estate page, so which gates exist is
configuration rather than code. Gate 1 and Gate 2 are marked in the demo data.

The courier carries no money, no codes and no fee, at any point.

### Releasing bags is one confirmation (point 9)

The request-then-approve round trip is gone. The agent at the counter confirms the courier standing
in front of them and hands the bags over in a single step, stamped with their name and the time. The
courier can still tell the desk they have arrived, but nothing waits on it.

### Free rides and discounts are tracked (point 18)

On the Mobility and Lagoon counters there is now a tick box on the payment step: **Free ride or
discount for this customer**. Ticking it asks for a reason — required, from the company's own list —
and then either a percentage or a free ride.

Every one is recorded against the booking with the amount, the reason, and who gave it. That feeds:

- **the manager dashboard**, which shows what was given away today, how many, and how many were free;
- **Reports → Free rides & discounts**, broken down by reason and by agent, with every row listed
  and a CSV export.

The reasons and their ceilings are edited by the CEO in **Operating rules**, alongside the penalty
schedule. No ticket number is involved — that is the separate discount-code feature, and it stays
separate.
