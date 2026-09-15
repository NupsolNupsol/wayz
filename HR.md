# HR — the cost side of the business

> Who they are, why the platform needs them, what every screen holds and why it is there.

**Sign in:** `hr.wayz@lockerflow.demo` / `People@123` → lands on `/hr`

---

## 1. Why this role exists

The accountant's figures are only as good as the costs behind them. VAT due is
`sales − returns − purchases`, and Zakat is 2.5% of net profit — both collapse if nobody records
what the business spends.

Somebody has to sit down and enter the supplier invoice, the boat repair, the fuel, the rent for
the lagoon, the rent for the staff accommodation, and the wages. That person is HR.

**HR writes the cost base. The accountant reads it.** Neither can do the other's job:

| | HR | Accountant |
|---|---|---|
| Record a cost | ✅ | ❌ |
| Void a cost | ✅ | ❌ |
| Charge a season's payroll | ✅ | ❌ |
| See the VAT return | ❌ | ✅ |
| See revenue | ❌ | ✅ |
| Touch a booking, payment or refund | ❌ | ❌ |

That separation is the point. The person who enters a number is not the person who reports on it.

---

## 2. Costs — `/hr`

### The four cards at the top

| Card | What it is | Why it is there |
|---|---|---|
| **Costs recorded** | How many live entries exist | A quick sanity check — an empty cost base means the tax figures are wrong |
| **Total (ex-VAT)** | The cost base before VAT | This is the number that reduces the taxable base |
| **Recoverable VAT** | The VAT paid on those costs | Input VAT — only ever from costs that actually carried VAT |
| **Not tied to an activity** | Shared costs | Staff accommodation is not the Lagoon's or the Scooters'. It is flagged, not hidden |

### By category

Every live cost, grouped. The categories are the ones the client named:

`Supplier / purchase` · `Maintenance` · `Repair` · `Fuel & oil` · `Venue rent` ·
`Accommodation rent` · `Payroll` · `Administrative` · `Bank commission` · `Other`

**Bank commission is the one category HR does not own.** It is posted by the platform from the
card transactions — one entry per day per scheme — and shows as *automatic* in the table. HR can
neither key one in nor void one: the bank took that money whether anybody agrees with it or not.
See [ACCOUNTANT.md](ACCOUNTANT.md).

Grouping matters because the accountant reports on it and the client thinks in it — "how much did
repairs cost this season" is a question the platform must be able to answer without a spreadsheet.

### The table

Every cost, sortable and filterable per column, paginated. Each row shows what the cost was, its
category, the activity it belongs to, its season, the amount before VAT, the VAT, and the total.

### Recording a cost

**Record a cost** → category, amount, description, supplier, invoice reference, activity, season,
date.

Three rules that are enforced on the server, not just in the form:

1. **The amount is entered VAT-inclusive** — exactly as it appears on the invoice. The platform
   splits it: `base = total ÷ 1.15`, `VAT = total − base`. Nobody does that arithmetic by hand.
2. **Payroll carries no VAT.** Wages are not a taxable purchase, so the whole amount is the base
   and the VAT is zero. The form does this automatically when the category is Payroll.
3. **A description under three characters, an amount of zero or less, an unknown category, an
   unknown activity or a season from another tenant** are all refused with a plain message.

### Voiding a cost

A cost is **never deleted**. It is voided with a reason, and the entry stays for the audit trail.
From the moment it is voided it stops counting towards VAT and Zakat. Voiding twice is refused,
and so is voiding a bank commission — that one is the platform's to post, not HR's to argue with.

**Why not delete?** Because "the number changed and nobody knows why" is exactly what an audit is
supposed to prevent.

### What happens downstream

The moment a cost is recorded:

- it joins the accountant's **purchases and expenses** bucket;
- the **net taxable base** falls by its base amount;
- the **VAT due to ZATCA** falls with it;
- **net profit** falls, and with it the Zakat;
- it appears in the accountant's transaction ledger and in the Excel exports.

---

## 3. Seasons & payroll — `/hr/seasons`

### Why seasons exist

The client was explicit: employees **must** be added every season, and their cost falls under the
administrative charges. Every six months, on every project.

A season is that container. Each card shows its dates, its cost base and its employee charges, and
a card with no charges yet is flagged in amber. **Click a card to open the season.**

### Creating one

**New season** → name and start date. The end defaults to **six months later**, because that is
the client's cycle. A season that ends before it starts is refused.

### Inside a season — `/hr/seasons/:id`

The season page answers "who is on this season and what did it cost", which the cards alone
cannot:

| Section | What it shows |
|---|---|
| **Four totals** | Cost base, administrative charges, how many of the tenant's employees are charged (`4 of 6`), and the operating costs on top |
| **Amber banner** | Named list of anyone not yet charged, and why that matters |
| **Employees** | Every operational employee, charged or not, with their monthly cost, the number of months, and what they were charged. Sortable and filterable. |
| **Operating costs** | The season's non-payroll costs — supplier invoices, repairs, rent — with category, activity and amounts |
| **Where the money went** | The season's costs grouped by category |

### Adding the employee charges

**Charge N employees** on the season page. The button says how many are left to charge, and is
disabled when nobody is.

The dialog is explicit before you commit to anything:

- how many will be charged, **and their names, grouped by role**;
- how many are **already charged** and will be skipped;
- the monthly cost per role, multiplied by the season's months, with a per-role subtotal;
- the exact **total added to the cost base**, on the button itself.

Three properties worth knowing:

- **Charging twice does not double the cost.** Anyone already charged is skipped, so it is safe to
  run again after hiring someone. When there is nobody left, the dialog says so plainly rather
  than reporting "0 added".
- **A role you leave at zero is reported, not silently dropped** — those people simply stay
  uncharged and remain on the amber list.
- **A season carrying no employee charges is flagged**, because the client requires them and a
  season without them under-reports the cost base.

---

## 4. What HR cannot do

Every one of these returns **403** from the server, not merely a hidden button:

- read the VAT return, the Zakat position or any revenue figure;
- open the manager, admin, kiosk or cashier workspace;
- create a booking, take a payment, issue a refund or open a shift;
- create or change a staff account;
- touch another tenant's costs — a WIQAR HR voiding a WAYZ cost gets a **404**, because the record
  does not exist as far as they are concerned.

---

## 5. Where the numbers come from

| Screen figure | Source |
|---|---|
| Cost totals and categories | `Expense` documents, status `RECORDED`, this tenant only |
| The VAT split on each cost | `splitInclusive(amount, tenant.vatRate)` in `domain/tax.ts` |
| Season totals | `Expense` rows joined on `seasonId` |
| Employee charges | One `Expense` per person per season, `reference` = their user id (that is what makes charging idempotent) |
| Bank commission | Posted by the platform itself, not by HR — see [ACCOUNTANT.md](ACCOUNTANT.md) |

---

## 6. Verification

**Backend — 15 specs** (`tests/hr.spec.ts`): the VAT-inclusive split at the tenant rate; payroll
carrying no VAT; a cost moving the accountant's VAT position and appearing in the ledger; voiding
taking it back out; every validation rejection; Zakat at 2.5% and zero when the season loses money;
a season carrying its charges and charging twice not doubling them; the seeded season already
carrying six months of charges; the overview grouping and flagging; tenant isolation both ways;
the route guards in every direction; only a tenant admin creating the HR account; and the bank
commission being refused both by hand and on void.

**Browser — 11 specs** (`tests/hr.spec.ts`): HR on the sign-in screen landing on its own
workspace; being bounced out of all seven other workspaces; the seeded totals on screen; recording
a cost and finding it in the table with the right split; the form refusing to submit without a
description and an amount; voiding needing a reason and lowering the totals; the cost travelling
through to the accountant's VAT position; a season carrying its charges idempotently; the
workspace being English-only; the tenant admin reaching the HR desk and being able to create the
role; and a manager being refused both.
