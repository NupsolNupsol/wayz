# WAYZ — The Till

> Who works the till, why it is a first-class thing, and what is on every one of its screens.
> Written so you can answer questions about it without opening the code.

---

## 1. Credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Kiosk agent** (works the till) | `agent.wayz@lockerflow.demo` | `Agent@123` | `/dashboard`, then **Till** in the sidebar |
| Second desk at the same station | `agent.morocco.wayz@lockerflow.demo` | `Agent@123` | its own till |
| **Supervisor** (reads it, settles a drift) | `supervisor.wayz@lockerflow.demo` | `Super@123` | `/manager` → Till & drawer |
| **Activity manager** (signs off your count) | `manager.wayz@lockerflow.demo` | `Manager@123` | `/manager/shifts` |

App: **http://localhost:5175** · API: **http://localhost:4000**

**On a fresh seed the Iran desk has:** an open till, drawer movements in its history, and
bookings waiting to be paid for.

---

## 2. There is no cashier any more

The client asked for the standalone cashier seat to be removed and its authority folded into the
kiosk agent: **one person serves the customer and takes their money.** That is what the platform
now does.

- The role `CASHIER` does not exist — not in the role union, not in the API, not in any list an
  admin can pick from. The old login is refused and `/api/cashier/*` is gone.
- The till lives at **`/till`** inside the agent's own workspace. `/cashier` still redirects
  there, because a printed shortcut should not break.
- The printed invoice's cashier line carries **the agent's own name**.

### So what is the control, if not segregation of duties?

The original reason for a separate seat was that the person handling the goods should not also
handle the money. With one seat, that control moves to three other places, all of which the
platform enforces:

| Control | How |
|---|---|
| Cash is attributable | Every payment records `takenBy` and the **shift** it landed in. A drawer belongs to a named person, not to a counter. |
| A drift is somebody else's problem | The moment a blind count does not balance, the supervisors and above are notified in-app, and only they can resolve the variance. Nobody signs off their own. |
| Money leaving the drawer is an exception | A till refund needs a supervisor or above. A drawer movement needs a written reason. Both are audited. |

### What the till is for, regardless

Even with one person doing both jobs, the till has to be a first-class thing:

- Cash must be attributable to a **named person's drawer**, or the end-of-day count means nothing.
- Money that leaves the drawer for reasons other than a refund — buying label rolls, banking the
  excess — has to be recorded, or the count will never balance.
- Refunds have to be a controlled action, not an edit.

---

## 3. Who reaches it

| Role | What they get |
|---|---|
| **Kiosk agent, chief captain** | Their own till: the overview, the payment queue, the transactions, the drawer |
| **Supervisor, activity manager, project manager, CEO** | The same screens, to read and to settle a drift — **plus** the refund the agent cannot make |
| Everyone else | 403 |

Scope comes from the token, not the request. A desk sees the queue, the transactions and the
drawer for **its own kiosk** — there is no filter or URL anyone can change to widen it.

---

## 4. The screens

### Till (`/till`)

The state of the counter in one view: what is in the drawer, what is waiting to be paid for, what
has been taken today and by which method, and whether a shift is open. Nothing here is an action —
it is the screen you glance at between customers.

### Awaiting payment (`/till/queue`)

Every booking that has been created but not paid for, oldest first, with how long it has been
waiting. Taking the money from here is the same transaction the agent would run from the booking
itself; the queue exists so nothing is quietly forgotten at the end of a busy hour.

### Transactions (`/till/transactions`)

The ledger for this desk: every payment and refund, filterable by method, kind and date. This is
what a shift close is reconciled against, and what a supervisor reads when a count does not
balance.

### Cash drawer (`/till/drawer`)

The float in, the cash sales, the cash refunds, the pay-outs, the banking drops, and what the
drawer should therefore hold. Recording a movement needs a reason — the drawer is the one place
where money moves without a customer in front of you, so every movement carries an explanation.

### Shift & count (`/shift`)

The blind count. You enter what is physically in the drawer without being shown what the system
expects, because a count you can see the answer to is not a count. If the two agree, the shift
closes. If they do not, the shift goes to **reconciling**, the supervisors are notified, and only
they can resolve it.

---

## 5. Refunds

Two paths, deliberately different:

| Path | Who | For |
|---|---|---|
| **Booking refund** — `POST /api/bookings/:id/refund` | The desk | The customer is standing there and the booking is in front of you |
| **Till refund** — `POST /api/till/payments/:id/refund` | Supervisor and above | Correcting a payment after the fact |

Both demand a written reason, both refuse to give back more than was taken, and both land on the
booking, in the ledger, in the VAT return and in the audit trail.

---

## 6. Verification

Covered by the browser specs in `frontend/tests/roles.spec.ts` — the agent finds the till inside
their own workspace, `/cashier` redirects to `/till`, a courier is bounced out, and the old
cashier login is refused — and by the API pass, which checks the same boundaries from the
outside.
