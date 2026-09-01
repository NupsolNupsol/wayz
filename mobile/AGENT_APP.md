# The kiosk agent app

The counter, on a handheld or a tablet. It talks to the same API as the web platform — there is
no second backend, no second source of truth, and no rule reimplemented here that the server
does not already enforce.

This is the first of the role apps. The delivery agent and the manager come next, and they will
reuse everything in `src/` unchanged.

---

## 1. Who it is for

The **kiosk agent** (`AGENT`): the person behind the counter who takes the booking, stores the
bags, verifies the customer, hands things back, and releases bags to a courier.

Signing in with any other role is refused on the sign-in screen with a plain explanation, rather
than letting someone into a workspace they cannot act in.

## 2. Navigation

```
/                          the gate — reads the stored token, then decides
/sign-in                   email + password
/today                     ← tab 1  the day at a glance
/operations                ← tab 2  every live session, urgent first
/sell                      ← tab 3  start something
/deliveries                ← tab 4  couriers at your desk   (badge = waiting)
/more                      ← tab 5  shift, incidents, assets, records, profile

/new/shop-drop             the five-step bag journey
/new/rental                mobility & lagoon
/booking/[id]              the booking console
/delivery/[id]             check the courier, release the compartment
/customer/[id]             one customer and their history
/customers /bookings /assets /incidents /shift /profile
```

Five tabs, because that is the most a thumb hits reliably. Everything deeper is **pushed on a
stack** so it gets a back gesture and the full width, instead of being crammed into a tab.

### One navigation, two shapes

`AdaptiveTabBar` renders the same route tree as a **bottom bar under the thumb** on a handheld
and as a **left rail** from 600dp up — with labels beside the icons past 1100dp. A bottom bar on
a 1280px counter tablet wastes the width and puts the controls a hand-span from the content.

`useDeviceClass()` is the single place that decides: `handheld` / `tablet` / `desk`, plus the
derived answers screens actually ask — how many columns, whether a list and its detail can share
the screen, and where long-form content should stop widening.

## 3. What the agent can do

| Screen | What it is for |
|---|---|
| **Today** | Money taken, transactions, what is running, what is late. A closed till is called out at the top, because cash taken without one cannot be reconciled. |
| **Running** | Every live session, sorted by *what runs out first*. Filters for running / late / handing back. |
| **New** | Only the activities this agent is assigned to. A booking they cannot fulfil is worse than no booking. |
| **Shop & Drop** | Customer → bags → packing plan → payment → scan in. Five steps in the order the counter works. |
| **Rental** | Product → customer → payment → handover, with the per-activity confirmation the engine requires. |
| **Booking console** | The timer, the actions the workflow *currently* allows, bag scan-out, the order, the custody trail. |
| **Deliveries** | Couriers waiting at the desk, and the two-part release: confirm who they are, then enter the compartment code. |
| **Shift** | Open the till, blind-count it, see the variance. |
| **Incidents / Assets / Customers / Bookings** | Report a problem; see what is free; find someone; find a booking. |

### Rules the app respects rather than reinvents

- **Payment never starts the timer.** Only scanning in does. Both wizards say so, and the
  console shows an amber note until it has actually started.
- **The action buttons come from the server** (`GET /bookings/:id/transitions`). The app cannot
  offer a step the engine would refuse, and does not try to guess one.
- **Storage will not confirm** until the compartment *and* every single bag is scanned. The
  sheet enforces it client-side so the agent is not surprised, and the API enforces it for real.
- **Retrieval is locked** behind a fresh identity check. The expiry is compared against a
  ticking clock, so a verification that lapses while the screen is open stops counting.
- **A courier never releases their own collection.** The release sheet needs an explicit "this
  is the named courier" tick *and* the code read off the kiosk.

## 4. Scanning

`ScanField` takes a barcode three ways, in the order a real counter gets them:

1. **A Sunmi hardware scanner** types into the field like a keyboard — nothing to configure.
2. **The camera**, via `expo-camera`, for a device without one.
3. **Typed by hand**, always available, including on web where the camera is hidden.

## 5. The design system

Screens never hand-roll a colour, a font size or a spacing. Everything comes from `src/components/ui`:

```
Screen  AppHeader  Card/Section  Button  Field/Input/TextArea  Sheet
ListRow/ListGroup/KeyValue  StatusPill  Segmented/Stepper/CheckRow/OptionRow
StepBar/Meter  Loading/EmptyState/ErrorState/Notice  toast
```

One tone table in `src/theme/tokens.ts` maps every workflow state — booking, bag, unit,
delivery, shift, payment, incident — to a colour, so the same state never looks calm on one
screen and urgent on another. `Sheet` is a bottom sheet on a handheld and a centred dialog on a
tablet; the content is identical, only where it sits changes.

Every control is at least 44dp, buttons carry a haptic tick, and destructive actions are red and
need a reason.

## 6. Running it

```bash
cd mobile
cp .env.example .env      # then set your machine's LAN address
npm start                 # scan the QR with Expo Go
```

The device cannot reach `localhost`, so `EXPO_PUBLIC_API_URL` must be the LAN address of the
machine running the API — see [SETUP_GUIDE.md](SETUP_GUIDE.md) §1 for the SDK/Expo Go pairing.

## 7. Proving it works

```bash
npm run typecheck && npm run lint && npm run doctor
npx expo export --platform android      # the real Hermes bundle
node smoke.mjs                          # drives the app against the live API
```

`smoke.mjs` opens the app in a browser at **390×844** and **1280×800**, signs in as the demo
agent, and walks the whole workspace: a wrong password is reported, the figures come from the
API, the navigation is a bottom bar on one and a rail on the other, the booking console opens,
the Shop & Drop wizard reaches real packing suggestions, every More destination opens, and
signing out returns to the login screen. **Any console error or failed API request fails the
run** — a screen that renders while logging a red box is not working.
