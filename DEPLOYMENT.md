# Deploying WAYZ

What to set, what to run, and what to switch off before the platform faces real customers.

---

## 1. The stack

| Piece | What it is | Notes |
|---|---|---|
| `backend` | Node + Express + Mongoose | Runs in Docker with MongoDB and Redis beside it |
| `frontend` | React + Vite, built to static files | Serve `frontend/dist` from any static host or the same box |
| `workflow` | The rules package, compiled into the API | `npm run build` inside `workflow/` before building the API image |


---

## 2. Environment

`backend/.env` — the ones that matter:

| Variable | Set it to | Why |
|---|---|---|
| `MONGO_URI` | your MongoDB connection string | The database |
| `REDIS_URL` | your Redis connection string | Sessions, rate limits |
| `JWT_SECRET` | a long random string, unique per environment | Signs the session token |
| `PUBLIC_API_URL` | `https://api.yourdomain.com` | WhatsApp fetches the invoice PDF from here |
| `PUBLIC_APP_URL` | `https://app.yourdomain.com` | The customer's tracking link and the invoice QR |
| `VONAGE_API_KEY` / `VONAGE_API_SECRET` / `VONAGE_WHATSAPP_NUMBER` | your Vonage credentials | WhatsApp codes and invoices |
| `SMTP_*` | your mail relay | Email codes and staff invitations |
| **`DEMO_TIME_TRAVEL`** | **`false`** | The testing clock. Leave it on and staff can age a booking into overtime |
| **`DEMO_SCANNER`** | **`false`** | Reveals bag barcodes to couriers for testing |
| **`OTP_TEST_PEEK`** | **`false`** | Lets a signed-in tester read an OTP back. Never in production |

Everything else has a working default in `backend/src/config/env.ts`.

---

## 3. Deploy

```bash
# 1 — the rules package
cd workflow && npm ci && npm run build

# 2 — the API (and Mongo, Redis)
cd ../backend && docker compose build api && docker compose up -d

# 3 — the web app
cd ../frontend && npm ci && npm run build      # serve frontend/dist
```

### Seeding

`npm run seed` **wipes the database** and rebuilds the demo tenant. Run it on a testing
environment only — never against production data.

```bash
docker compose exec api npm run seed
```

A fresh production database needs, at minimum: a tenant, a site, a station, at least one kiosk,
the asset types and units, the catalogue, and the first CEO account. Create those through the
platform (the CEO's Estate and Team pages) rather than the seed.

---

## 4. After the first deploy — check these

1. **Sign in** as the CEO and open **Estate → Station map**: place the stations and desks. The
   captain's chart reads those positions.
2. **Operating rules** (grace period, overtime rate, timers) — the tenant's own numbers.
3. **Pricing** — hourly and tour prices per product.
4. **Send a test invoice**: take a payment for a customer whose WhatsApp you can read. The PDF
   should arrive as an attachment; if it arrives as text, `PUBLIC_API_URL` is not publicly
   reachable (see `WHATSAPP_INVOICE.md`).
5. **Open `/versions`** — the release notes are public, so the team can read what changed without
   an account.

---

## 4b. The release-notes page

`/versions` is deliberately **public** — the team reads it without an account, and anyone who
tests a change can check it off or report a problem from the page. Those two actions are
unauthenticated by design (they only ask for a name), rate-limited like the rest of the public
surface, and capped in length.

If a deployment should not carry that, put the path behind your reverse proxy's basic auth, or
drop the two `POST /api/public/versions/...` routes — reading the notes keeps working either way.

**Publishing the release notes on a deploy** — this does not touch anything else in the database:

```bash
docker compose exec api npm run seed:versions
```

It replaces the release notes with the ones shipped in `backend/src/seed/versions.seed.ts` (four
releases covering everything built so far, each change with its own test steps and links). Safe to
run on any environment, including one carrying real bookings.

Releases are records, not files. Add one at runtime with:

```bash
curl -X POST https://api.yourdomain.com/api/admin/versions   -H "Authorization: Bearer <CEO token>" -H "Content-Type: application/json"   -d '{"number":"2026.09.11","name":"...","summary":"...","highlights":["..."],
       "changes":[{"area":"Delivery","title":"...","detail":"...","roles":["Kiosk agent"],
                   "howToTest":["Sign in as ...","..."],"expect":"...",
                   "links":[{"label":"Bookings","to":"/bookings"}]}]}'
```

---

## 5. Health and monitoring

- `GET /api/health` — liveness for the load balancer.
- The API logs one JSON line per request and per domain event; ship them wherever you keep logs.
- Every money movement, till action and staff action is written to the audit trail, readable by
  the CEO under **Activity log**.

---

## 6. Running the tests against a deployed environment

```bash
cd backend && npm run test:roles      # and rules, notes, shift, lagoon, hr, multikiosk, map
cd ../frontend && npx playwright test
```

Both passes expect the demo seed. Point them at a **testing** environment, never production —
they create and cancel real bookings.


## Email that arrives, not just email that sends

`Email sent` in the API log means the SMTP host accepted the message. It does **not** mean anybody
received it. A provider such as Gmail will accept mail from a domain and then drop or spam-file it
when that domain has no SPF, DKIM and DMARC records lined up with the sending host — which is what
happened on the demo when codes went out from `nupsol.com` to Gmail inboxes.

Two ways to make the email channel actually deliver:

1. **Line up the sending domain.** Publish SPF for the sending host, sign with DKIM, and set DMARC
   to at least `p=none` while you watch the reports. This is the production answer.
2. **Send from a mailbox the recipient's provider already trusts.** For demos, pointing
   `MAIL_HOST` / `SENDER_EMAIL` / `SENDER_PASSWORD` at a Gmail account with an **app password**
   (never the account password) delivers to Gmail reliably. Keep the domain host as
   `MAIL_FALLBACK_*` so nothing is lost if the primary refuses.

Whitespace in either password is stripped before use, so an app password pasted in its displayed
groups of four works as-is.

If codes stop arriving, read the API log before changing credentials: `Email send failed` names the
host and the SMTP error (`535` is a rejected login), while `Email sent` points at deliverability
rather than configuration.
