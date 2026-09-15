# The accountant — VAT, Zakat, card commissions and the exports

> Who they are, why the platform needs them, what every screen holds, the exact arithmetic behind
> every figure, and what they deliberately cannot do.

**Sign in:** `accountant.wayz@lockerflow.demo` / `Account@123` → lands on `/accounting`

---

## 1. Why this role exists

The business owes money to two authorities on two different cycles:

| | Cycle | Rate | Base |
|---|---|---|---|
| **VAT** | Quarterly | 15% | Sales − returns − purchases, all before VAT |
| **Zakat** | Annually | 2.5% | Net profit |

Both are only paid when the business is actually ahead. A quarter where purchases exceed sales
produces a **refund**, not a bill; a year with no profit produces **no Zakat at all**.

The accountant is the person who files those. They need every number the operation produces —
and they must not be able to change a single one of them.

**The accountant is strictly read-only over the operation.** They cannot create a booking, take a
payment, issue a refund, open a shift, or change a staff account. What they *can* write is
confined to their own desk: the card commission rates, and importing a transaction feed.

---

## 2. VAT & activities — `/accounting`

### The period

Everything on the page follows the From/To dates. VAT is filed quarterly, so the accountant picks
the quarter. The Activity selector narrows the whole page to Lagoon, Scooters or Shop & Drop
alone — that is how "how did the Lagoon do this quarter" gets answered without touching the other
two.

### The four cards

| Card | Meaning |
|---|---|
| **Sales (ex-VAT)** | Everything sold in the period, before VAT, with the VAT shown underneath |
| **Returns (ex-VAT)** | Refunds, before VAT |
| **Purchases & expenses** | Everything HR recorded, plus petty-cash pay-outs, plus bank commission |
| **VAT due / refundable** | The bill, and the base it came from |

### The VAT return panel

The exact ZATCA arithmetic, laid out as the authority expects it:

```
Net taxable base = Sales base − Returns base − Purchases base
Due VAT          = Net taxable base × 15%
```

A negative base flips the panel to **Refundable from ZATCA** — the client's own third-quarter
figures include exactly that case (a month with `−94,761.00` base and `−14,214.15` VAT), and the
platform reproduces it.

**Input VAT is the VAT actually paid, not 15% of every purchase.** Payroll and bank commission
carry no VAT, so they reduce the taxable base without adding anything reclaimable. Deriving input
VAT from the base would have over-reported it on every wage and every commission.

### The Zakat panel

```
Net profit = revenue after returns − costs recorded − VAT already paid
Zakat due  = net profit > 0 ? net profit × 2.5% : 0
```

Zakat is annual and comes *after* the VAT, which is why the VAT already paid is deducted before
the 2.5% is applied. When the year is not in profit the panel says so plainly and the figure is
zero — no negative Zakat, no bill.

### By activity

One card per activity, each with its own sales, VAT, gross and returns, and its net base. The
three add up to the totals; each can also be read alone through the Activity selector.

### The Excel exports

The supervisor asked for two phases, and both are here.

| Phase | Button | What is in it |
|---|---|---|
| **1 — one activity, in full detail** | Lagoon / Scooters / Shop & Drop | A detail sheet with every transaction of that activity — date, process type, details, reference, base, VAT, total — with live `SUM()` totals; a summary sheet with that activity's figures and VAT return; and a card commission sheet |
| **2 — all activities, summarised** | Export all activities | One consolidated sheet totalling each activity side by side, the ZATCA lines underneath, and the card commission sheet |

Both are real `.xlsx` (not CSV renamed), right-to-left, with Arabic column headings, `#,##0.00`
number formats, frozen headers and formulas — shaped to the client's own quarterly workbook. A
plain CSV export of the ledger is also available.

**The screen is English. The exported files are Arabic**, because that is what gets filed.

### Transaction detail

The same rows the export contains, sortable and filterable per column. Filter it before exporting
to see exactly what you will get.

---

## 3. Card commissions — `/accounting/commissions`

### The contract

There is a fixed commission per card scheme in the contract with the acquiring bank. The bank
takes its cut off the top; the business receives the rest.

| Card type | Rate |
|---|---|
| Mada Card | 0.75% |
| SPAN Card | 0.75% |
| Visa Card | 2.60% |
| Master Card | 2.60% |
| GCC Card | 1.75% |

Those are the defaults the platform ships with. **Every one is editable by the accountant**, so a
renegotiated contract does not need a release.

### How it is booked — the important part

> The amount the bank keeps is **an expense, not a tax**.

It is posted as a **bank commission expense** — one entry per day per card scheme — which means:

- it **reduces the taxable base**, so the VAT due falls;
- it **reduces net profit**, so the Zakat falls;
- it appears in the ledger and the exports as an expense line;
- it **never** appears as VAT collected or VAT paid, and no input VAT is reclaimed on it.

The page says this on screen, because it is the kind of thing that gets booked wrongly once and
then stays wrong for a year.

### Changing a rate

Edit the percentage and save. Two rules:

1. **A new rate prices everything imported afterwards.** Each transaction stores the rate it was
   priced at, so history stays true when the contract changes.
2. **Settled money is never re-priced.** Ticking the re-price box corrects transactions that have
   not settled yet and leaves the settled ones alone — a rate correction cannot rewrite a bank
   statement.

A rate above 20% is refused as a typing mistake, as is a negative one or an unknown scheme.

### The figures

Gross volume, commission withheld, net settled, and the blended effective rate across every
scheme — then the same per scheme, with each one's share of the volume.

---

## 4. Transactions & reconciliation — `/accounting/transactions`

> A field-by-field walkthrough of this page lives in [TRANSACTIONS.md](TRANSACTIONS.md).

### Source-agnostic by design

The commission can only be calculated against real card transactions, and there are two ways those
could reach the platform: read straight off the payment terminal (TPE), or delivered as a nightly
extract from the acquirer (ETL).

**The platform does not care which.** Both arrive through the same door — one ingest function, one
table, one set of fields. Each row is stamped with where it came from, so the difference is
recorded without being structural. If the integration changes from one to the other, nothing above
the ingest layer changes.

### What a row carries

`externalRef` (the acquirer's reference) · `scheme` · `grossAmount` are required. Everything else
is optional: terminal id, masked PAN, auth code, currency, activity, station, the platform payment
it belongs to, capture date, settlement date, status.

On arrival each row is priced: commission rate for its scheme, commission amount, net settled, and
the VAT split of the gross.

### Importing

**Import a feed** → pick the source → paste the rows → import. Four properties worth knowing:

1. **Replaying a feed is safe.** A reference already imported is skipped and counted as a
   duplicate, so a nightly extract can be re-run without creating doubles.
2. **Scheme names are normalised.** `MASTER CARD`, `Mastercard`, `MC` and `MASTERCARD` all land on
   the same scheme, because no two feeds spell them the same way.
3. **A broken row does not sink the batch.** An unknown scheme, a non-positive amount, a broken
   date or a missing reference is rejected *and reported back with its reason*, while the rest
   still lands.
4. **The commission expenses are re-posted after every import**, so the accountant's VAT and Zakat
   figures move the moment the feed lands.

### Reconciliation

The terminal against the platform, for the same period, in four buckets:

| Bucket | Meaning |
|---|---|
| **Matched** | The terminal and the platform agree on both the amount and the card |
| **Amount differs** | Both saw it, for different amounts |
| **Card differs** | Same money, but the agent recorded a different card scheme than the terminal reported |
| **Only at the terminal** | A card transaction the platform never recorded |
| **Only in the platform** | A card payment the terminal never reported |

Only the exceptions are listed — a table of thousands of matched rows tells nobody anything. Each
exception shows both amounts and the difference. A handful is normal; the point is that they are
visible rather than buried in a total.

---

## 5. What the accountant cannot do

Every one of these returns **403** from the server:

- create a booking, take a payment, refund a payment, open a shift, create a delivery;
- create or change a staff account;
- open the manager, admin, kiosk, cashier or HR workspace;
- record or void a cost — that is HR's job;
- change the company record or the tax rate — that is the tenant admin's;
- see another tenant's anything. A WIQAR accountant's export contains WIQAR's figures and nothing
  else, and a WIQAR rate change leaves WAYZ's rates untouched.

---

## 6. Where every number comes from

| Figure | Source |
|---|---|
| Sales, returns | `Payment` documents, `baseAmount` / `vatAmount` stamped at the point of sale |
| Purchases | `CashMovement` pay-outs + `Expense` documents (HR's costs and the bank commission) |
| Net taxable base, VAT due | `zatcaReturn()` in `domain/tax.ts` |
| Zakat | `zakatAssessment()` in `domain/tax.ts`, rate from `tenant.zakatRate` |
| VAT rate | `tenant.vatRate` — never a literal in the code |
| Commission rates | `CommissionRate` per tenant per scheme, defaulting to `DEFAULT_COMMISSION_RATES` |
| Commission amounts | `commissionOn()` in `domain/commission.ts`, stamped on each transaction at ingest |
| Card volume | `CardTransaction` documents |

Amounts are stored **VAT-inclusive** and split at the point of sale, so the report never
re-derives them — `base = total ÷ 1.15` happens once, where the money is taken.

---

## 7. Verification

**Backend — 31 specs** (`tests/accounting.spec.ts`, `tests/commissions.spec.ts`):

- the ZATCA formula reproduces the client's own quarterly figures exactly, including the
  refundable month;
- every money row carries a base and a VAT amount and they sum to the total;
- the three activities are reported independently and add up;
- the tax rate comes from the tenant, not the code;
- Zakat is 2.5% of net profit and zero when the season loses money;
- both export phases produce real workbooks with the right sheets, headings, totals and formulas;
- a date range narrows both phases;
- the contract rates default to the bank agreement, and nonsense rates are refused;
- a rate change prices the next import and never rewrites settled money;
- a terminal feed and an extract arrive through the same door with identical results;
- replaying a feed imports nothing twice, within a batch or across batches;
- a broken row is reported back while the rest lands;
- the commission is booked as an expense with zero VAT, lowers the VAT due and the Zakat;
- the terminal and the platform reconcile row by row, and an orphan transaction surfaces;
- the accountant is refused every write outside their own desk;
- one tenant never sees another's card volume, figures or exports.

**Browser — 24 specs** (`tests/accounting.spec.ts`, `tests/commissions.spec.ts`): the arithmetic
adding up on screen, the Zakat panel, both export buttons downloading real `.xlsx`, the contract
rates opening on the agreement values, editing and restoring them, each scheme charged at its own
rate, importing a feed through the UI and finding it priced in the table, a bad feed reported
instead of swallowed, an orphan transaction surfacing in the reconciliation, the commission
appearing as a zero-VAT expense in the ledger, every page being English-only, and every other role
being turned away.
