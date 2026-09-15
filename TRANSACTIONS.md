# The Transactions page — what every part of it means

> The accountant's **Transactions** screen (`/accounting/transactions`), explained piece by piece:
> what each number is, where it comes from, why it is on the page at all, and what to do when it
> looks wrong.

**Sign in:** `accountant.wayz@lockerflow.demo` / `Account@123` → **Transactions** in the sidebar

---

## 1. Why this page exists

The bank does not hand the business the full amount a customer paid. When a card is swiped, the
acquiring bank keeps a commission and settles the rest. To close the books you need three things
the platform cannot invent on its own:

1. **What the terminal actually saw** — which card, which scheme, how much, when.
2. **What the bank kept** — the commission, per scheme, at the contract rate.
3. **Whether that agrees with what the platform recorded** — the reconciliation.

This page is all three. Everything else in the accountant's workspace (VAT, Zakat, the exports)
depends on it being right.

### Where the rows come from — and why the platform does not care

The supervisor left this open: the figures would come **either** straight off the payment terminal
(the TPE), **or** as an extract from a transaction table pushed on a schedule (an ETL feed).

So the platform was built to not have an opinion. **Both arrive through the same door** — one
ingest function, one collection, one set of fields. Each row records which source it came from, so
the difference is *recorded* without being *structural*. If the integration changes from one to
the other later, nothing above the ingest layer changes: not the commission maths, not the VAT,
not the Zakat, not the exports, not this page.

That is what "source-agnostic" means here, and it is the reason the seeded data is a mock table
rather than a live terminal driver. The mock stands in for the feed; everything downstream of it
is real.

---

## 2. The filter bar

| Control | What it does |
|---|---|
| **From / To** | The capture dates. Everything below follows them — the totals, the reconciliation and the table. |
| **Card scheme** | Narrows the whole page to one scheme. Useful for "what did Visa cost us in March". |

---

## 3. The four totals

| Card | What it is | How it is worked out |
|---|---|---|
| **Transactions** | How many card payments landed in the period | Count of live transactions. Refunded and reversed ones are counted separately in the sub-line, because a reversal is not a sale. |
| **Gross** | What customers paid, VAT included | Sum of `grossAmount` |
| **Commission withheld** | What the bank kept | Sum of `commissionAmount` — each row priced at its own scheme's rate |
| **Net settled** | What actually reaches the bank account | `Gross − Commission` |

**Gross − Commission = Net settled**, always. If those three ever disagree on screen, something is
wrong with the data, not the arithmetic.

---

## 4. The reconciliation panel

The terminal is one record of what happened; the platform's own payments are another. They should
agree. This panel is where you find out that they do not.

| Bucket | Meaning | What it usually means in practice |
|---|---|---|
| **Matched** | Both sides saw it, same amount and same card | Normal. The overwhelming majority. |
| **Amount differs** | Both saw it, for different amounts | A tip added at the terminal, a partial capture, or a keying error |
| **Card differs** | Same amount, but the agent recorded a different card scheme than the terminal reported | The agent picked the wrong card at the counter. The commission is right (it comes from the terminal), but the platform's own record is not — worth correcting so the operational view matches the bank's |
| **Only at the terminal** | The terminal reported a payment the platform never recorded | A sale rung up on the card machine but never entered in the POS — the most important one to chase |
| **Only in the platform** | The platform recorded a card payment the terminal never reported | A payment recorded against the wrong method, or a feed that has not caught up yet |

Underneath: **Terminal** and **Platform** totals side by side, and a **Balanced / Needs attention**
badge.

**Only the exceptions are listed.** A table of a thousand matched rows tells nobody anything, and
shipping them to the browser is what made this page slow. The line above the table says how many
were compared; the table shows only what did not line up, with both amounts and the difference.

A handful of exceptions is normal and expected. The point is not that the number is zero — it is
that you can see them and go and ask.

### How a payment and a transaction are matched

By `paymentId`. When the feed carries the platform's payment id, the two are paired directly. A
transaction with no `paymentId` can never match, which is exactly why it shows as **Only at the
terminal** — the platform genuinely has no record of it.

Once paired, two things are compared: the **amount** and the **card scheme**. Cash payments are
excluded from the comparison entirely — they never went near a card machine, so the terminal is
not expected to have seen them.

Refunds are excluded from the platform side of the comparison, because a refund goes back to the
card as its own terminal event rather than being a second copy of the sale.

---

## 5. The transaction table

One row per card payment, as the terminal saw it.

| Column | What it is |
|---|---|
| **Captured** | When the card was swiped |
| **Reference** | The acquirer's reference (RRN) — the top line — and beneath it the masked card number, or the terminal id if the feed did not send a PAN |
| **Scheme** | Mada, SPAN, Visa, Mastercard or GCC. Normalised on the way in, so `MASTER CARD`, `Mastercard` and `MC` all land on the same scheme |
| **Source** | `TPE` (read off the terminal), `ETL` (a scheduled extract), or `MANUAL` (keyed in) |
| **Gross** | What the customer paid, VAT included |
| **Rate** | The commission rate **that this row was priced at** — not today's rate |
| **Commission** | `Gross × Rate` — what the bank kept |
| **Net settled** | `Gross − Commission` |
| **Status** | `CAPTURED` (taken, not yet settled), `SETTLED` (money has landed), `REFUNDED`, `REVERSED` |

Every column filters and the money columns sort.

### Why the rate is stored on the row

Because contracts change. If the bank renegotiates Visa from 2.60% to 2.20% in June, the
transactions from May must keep costing 2.60% — that is what actually happened. Storing the rate
on each transaction is what keeps history true, and it is why a rate change on the **Card
commissions** page never rewrites the past.

---

## 6. Importing a feed

**Import a feed** → choose the source → paste the rows → Import.

The rows are JSON. Only three fields are required:

| Field | Required | Notes |
|---|---|---|
| `externalRef` | ✅ | The acquirer's reference. This is the identity of the transaction. |
| `scheme` | ✅ | Any spelling of the five schemes |
| `grossAmount` | ✅ | What the customer paid, VAT included. Must be positive. |
| `capturedAt` | | Defaults to now |
| `terminalId`, `maskedPan`, `authCode`, `currency` | | Carried through as-is |
| `engineKind` | | Ties the row to Lagoon, Scooters or Shop & Drop |
| `paymentId` | | The platform payment it belongs to — this is what makes it reconcile |
| `settlementDate`, `status` | | Defaults to unsettled |

### Four behaviours worth knowing

1. **Replaying a feed is safe.** A reference already imported is skipped and counted as a
   duplicate. A nightly extract can be re-run — after a failure, say — without creating doubles.
   The same applies *within* one batch: the same reference twice imports once.
2. **A broken row does not sink the batch.** An unknown scheme, a zero or negative amount, a
   broken date or a missing reference is rejected **and reported back with its reason**, while
   every good row still lands. You see exactly which ones failed and why.
3. **Pricing happens on arrival.** Each row is stamped with its scheme's current rate, the
   commission, the net, and the VAT split of the gross.
4. **The commission expenses are re-posted straight away**, so the VAT and Zakat figures move the
   moment the feed lands — no separate step, nothing to remember.

---

## 6.5 Where the card scheme comes from

The agent chooses it at the point of sale. When they tap **Card**, the payment panel asks *which*
card — Mada, SPAN, Visa, Mastercard or GCC — and refuses to take the payment until one is picked,
because the bank charges a different commission for each. Cash cannot carry a scheme, and the
server refuses a payment that claims otherwise. A refund goes back the way the money came, keeping
the scheme of the payment it reverses.

**That choice does not set the commission.** The terminal feed does. What the agent records is the
platform's own account of the sale; the terminal is the bank's. Keeping both is the entire point —
when they disagree, the reconciliation says so instead of quietly averaging them.

So a card payment on its own moves no commission. The commission appears when the feed lands, at
the scheme the *terminal* reported.

---

## 7. What happens to the commission afterwards

This is the part the client was most specific about.

> The amount the bank keeps is **an expense, not a tax**.

So the platform posts it as a **bank commission expense** — one entry per day per scheme, entered
by the system rather than a person. That means:

- it lands in the accountant's **purchases and expenses** bucket;
- the **net taxable base** falls, so the **VAT due** falls with it;
- **net profit** falls, so the **Zakat** falls with it;
- it appears in the ledger and both Excel exports as an expense line;
- it **never** appears as VAT collected or VAT paid, and **no input VAT is reclaimed on it**.

Because it is a fact from the bank rather than a judgement call, **HR can neither key one in nor
void one** — the category is not offered on the cost form, and those rows show as *automatic*
instead of a Void button. The bank took that money whether anyone agrees with it or not.

---

## 8. Who can see this page

Only the **accountant** and the **tenant admin**. Every other role — agent,
cashier, delivery agent, manager, HR — gets a **403** from the server, not merely a hidden link.
And a WIQAR accountant sees WIQAR's transactions only; a rate they change does not touch WAYZ.

---

## 9. Where each number comes from in the code

| Screen figure | Source |
|---|---|
| The table rows | `CardTransaction` documents, this tenant only |
| Commission per row | `commissionOn()` in `domain/commission.ts`, stamped at ingest |
| The rate used | `CommissionRate` per tenant per scheme, falling back to `DEFAULT_COMMISSION_RATES` |
| The four totals | `transactionSummary()` in `services/transactions.service.ts` |
| The reconciliation | `reconcile()` — card transactions against non-refund card `Payment` records |
| The VAT split on each row | `splitInclusive(gross, tenant.vatRate)` |
| The commission expenses | `postCommissionExpenses()`, keyed `comm:<date>:<scheme>` so re-posting is idempotent |

---

## 10. Verification

**Backend** (`tests/commissions.spec.ts`): a terminal feed and an extract produce identical
results; replaying imports nothing twice, across batches and within one; a broken row is reported
while the rest lands; scheme names normalise; each row is priced and VAT-split correctly; a rate
change prices the next import but never rewrites settled money; the commission is booked as a
zero-VAT expense and lowers both the VAT due and the Zakat; the reconciliation classifies every
row and an orphan transaction surfaces; a date range narrows everything; and the page is closed to
every role but the accountant and tenant admin, per tenant.

**Browser** (`tests/commissions.spec.ts`): the totals holding together on screen; a feed imported
through the UI appearing priced in the table; a bad feed reported instead of swallowed; an orphan
transaction surfacing in the reconciliation; and the commission showing as a zero-VAT expense in
the VAT report.
