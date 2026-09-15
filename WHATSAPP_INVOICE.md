# The WhatsApp invoice — how it works and how to test it

## What happens when a customer pays

1. The agent takes the payment. Nothing else is needed from them.
2. The browser renders the invoice as a PDF — the same document that prints on the 80 mm roll,
   carrying the tracking QR code.
3. The PDF is handed to the API, which parks it behind a short-lived public link:
   `GET /api/public/invoice/:token`. The link is unguessable, expires, and identifies nobody.
4. The API asks Vonage to send a WhatsApp message with that link as the attachment.
5. Vonage's servers **fetch the PDF from that link themselves** and deliver it to the customer.

## Why it needs a real address

Step 5 is the whole point: Vonage does not accept an uploaded file for WhatsApp. Its Messages
API takes media as a **URL only** — `{ message_type: "file", file: { url, caption } }` — and
their servers go and get it. There is no endpoint to POST the bytes to, so the API cannot
"attach" a PDF it holds in memory; it can only publish a link that Vonage can reach.

That is why a laptop cannot deliver the attachment: `http://localhost:4000/...` means nothing to
a server in Vonage's data centre. The platform detects this and does the honest thing — it sends
the thank-you as **text with the invoice link in it**, and reports that the attachment could not
go. The API also says so on startup:

```
WhatsApp invoices will send as text only: PUBLIC_API_URL is not publicly reachable
```

## In production — where it just works

Set one variable to the address the API answers on from the internet:

```bash
# backend/.env
PUBLIC_API_URL=https://api.yourdomain.com
PUBLIC_APP_URL=https://app.yourdomain.com
```

Then restart the API (`docker compose up -d api`). Nothing else changes: once the address is
publicly reachable and serves HTTPS, every paid sale sends the PDF by itself.

Requirements for the address:

- reachable from the public internet (no VPN, no private IP, no `localhost`)
- HTTPS with a valid certificate — Vonage will not fetch from a bad certificate
- `GET /api/public/invoice/<token>` must answer without authentication (it already does; the
  token is the only key, and it expires)

## Testing it on the deployed domain

1. Sign in as a kiosk agent and open the till.
2. Make a booking for the customer whose WhatsApp you can read. The seed already contains one
   for the Vonage sandbox: **mouad houmada / mouadhoumada@gmail.com / +212 628436082**. For any
   other number on the sandbox, whitelist it in the Vonage dashboard first.
3. Take the payment.
4. The customer's WhatsApp should receive the thank-you **with the PDF attached** within a few
   seconds. The agent sees a green "Invoice sent" toast naming the phone.
5. Open the PDF: it carries the seller, the CR and VAT numbers, the branch and desk, the agent's
   name on the الكاشير line, the lines, how it was paid, the totals, the barcode, and the QR that
   opens the customer's live tracking page.

### If the attachment does not arrive

| What you see | What it means | What to do |
|---|---|---|
| Amber toast: "Sent, but without the PDF" naming an address | `PUBLIC_API_URL` is unset or not publicly reachable | Set it to the deployed API address and restart |
| Nothing arrives at all, sandbox in use | The number is not whitelisted on the Vonage sandbox | Add it in the Vonage dashboard |
| Red toast naming a provider error | Vonage rejected the send | Check `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_WHATSAPP_NUMBER` |
| Message arrives, attachment missing, address looks right | Vonage could not fetch the link | Open `https://<your api>/api/public/invoice/<token>` from outside your network; check HTTPS and the certificate |

### Testing it locally, before deploying

Expose the API with a tunnel and point the variable at it:

```bash
cloudflared tunnel --url http://localhost:4000     # or: ngrok http 4000
# paste the https address it prints:
#   backend/.env → PUBLIC_API_URL=https://something.trycloudflare.com
docker compose up -d api
```

The startup warning disappears when the address is publicly reachable, and the PDF then attaches
exactly as it will in production.

## What is sent

- **Attachment**: the invoice PDF, rendered at roll width so the customer's copy is the same slip
  that came off the printer.
- **Caption / text**: the brand's thank-you, the invoice reference and total, and the tracking
  link so the customer can follow their booking.
- **Fallback**: where the attachment cannot go, the same message plus a direct link to the
  invoice, so the customer is never left with nothing.

---

## Why the links looked like plain text

WhatsApp turns a URL into a tap-able link itself — there is no markup to add, and the message is
already written with each link alone on its own line so nothing runs into it. What it will not
linkify is an address it cannot believe in: `http://localhost:5173/track/...` or a private
`http://192.168.x.x/...` is shown as text, because there is nowhere for a phone to go.

The moment `PUBLIC_API_URL` and `PUBLIC_APP_URL` point at the deployed HTTPS domain, the same
message arrives with both the tracking link and the invoice link tappable — and the PDF arrives
as an attachment rather than a link at all. Nothing in the message needs changing to get there.

