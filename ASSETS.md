# Assets — one estate, three roles

`/assets` is the single place the estate lives. The manager, the tenant admin and HR all open
the same page, with the same rights. Agents can read it and scan stickers, but change nothing.

There is no second assets page. `/manager/estate` and `/admin/assets` redirect here.

---

## 1. The three records, and why there are three

| Record | What it is | One row per | Example |
|---|---|---|---|
| **AssetType** | A *kind* of asset. Its physical shape and capacity. | Kind | "Compartment L" — 60×40×80 cm, holds 3 bags |
| **AssetUnit** | One *physical* asset you can touch. | Individual thing | `CMP-07`, sitting at Gate 1, currently occupied |
| **CatalogueProduct** | What the counter *sells*, and for how much. | Sellable line | "Compartment L" at 88.00 SAR, deposit 0, PER_COMPARTMENT |

They are not three names for one thing:

- The **kind** answers *"what shape is it, and will these bags fit?"* — the packing engine reads
  `capacity` off it to choose a compartment.
- The **asset** answers *"which one, and is it free right now?"* — reservation, storage and
  retrieval all move a specific unit's `status`.
- The **product** answers *"what does the customer pay?"* — the order, VAT and the ledger read it.

`CatalogueProduct.assetTypeId` is the join. One kind is sold by one product.

### Why price does not live on the asset

If the price lived on every unit, changing it would mean editing 40 rows and a booking taken
mid-edit could charge either number. It lives on the product, once. A single asset can still
depart from it — `AssetUnit.priceOverride` — for the scooter with a dented panel you rent cheaper.
The effective price is `priceOverride ?? product.basePrice`, resolved in one place in the API.

---

## 2. Creating a kind — what actually happens

From `/assets` → **New kind**. You give it a shape (Compartment / Vehicle / Boat), a name, an
activity, a price, and its capacity. On submit, in one request:

1. An **AssetType** is created with the capacity you entered.
2. A **CatalogueProduct** is created for it, with your price, and a billing model inferred from
   the shape — compartments bill `PER_COMPARTMENT`, vehicles and boats bill `DURATION_BASED`.
   The kind is sellable at the counter the moment it exists; a kind with no product would be
   a label with no price.
3. If you asked for *N* first assets, *N* **AssetUnit** rows are created at the station you chose.

**Answering the question directly: yes — asking for 20 creates 20 independent assets.** You are
never made to add them one at a time. Each one is its own row with its own identifier
(`SCO-01 … SCO-20`), its own status, its own QR code and its own optional price. They are
independent from the moment they exist: suspending `SCO-07` does not touch `SCO-08`.

What the *count* is not: it is not a quantity field on the kind. There is no
`AssetType.count` anywhere. The estate's "Total 20" is a `COUNT()` over the unit rows, so it
stays honest when one is deleted or another is added at a second station.

---

## 3. Naming and identifiers

Identifiers are generated from the kind's name — the first three letters, uppercased — plus a
running number: "Single Scooter Bay" → `SIN-01`, `SIN-02`. Adding more later continues the
sequence and skips any identifier already taken, so re-adding after a deletion never collides.
Any single identifier can be edited by hand; uniqueness is enforced within the kind.

---

## 4. Status: what a person may set, and what the workflow owns

```
settable by hand   AVAILABLE   OUT_OF_SERVICE   MAINTENANCE   BLOCKED
moved by workflow  HELD   RESERVED   OCCUPIED   RETRIEVAL_PENDING   INSPECTION_REQUIRED
```

Trying to *set* a workflow status by hand is refused (400) — the booking engine owns those.
Trying to take a **busy** asset out of service is refused (422): finish or reassign its booking
first. Putting a busy asset **back** to `AVAILABLE` is allowed and is the release itself — it
detaches the booking link. That is deliberate: a locker that is physically empty but reads
`OCCUPIED` has to be recoverable, and it is offered as **Force free** with a confirmation, and
written to the audit trail.

---

## 5. QR codes

Every asset carries a code encoding `https://<host>/assets/unit/<unitId>`.

- **Print or download** it from the asset's row or its page — the PNG is rendered at 900 px with
  the identifier printed under it, so it survives being stuck on a scooter.
- **Scanning it** opens that asset's page. An agent sees what it is, where it is, its price and
  the booking holding it. A manager, admin or HR additionally gets suspend / restore / edit.
- Nothing about the code is a secret: it resolves through the normal API, which is tenant-scoped,
  so a code from another tenant returns 404 rather than leaking a row.

---

## 6. Pricing, from both ends

| Where | What it changes |
|---|---|
| `/assets` → **Price** on a row, or the detail page's **Price all** | The kind's product: what it is **sold by**, whether it is a **rental or a sale**, the base price, the deposit, the **damage penalty**, and the overtime rate. Optionally clears every per-asset override in the same move. |
| An asset's **Edit** → *Price this one apart from its kind* | Only that asset's `priceOverride`, and its own **replacement value** |

Both write to the audit trail with the before and after figures.

Pricing a kind also refreshes `/manager/pricing`, because it is the same product row seen from
the other side. There is one price, reachable from two screens — not two prices.

### Sold by, and sale type

Section 2.2 of the client's brief names a **unit** and a **sale type** on every line, so the
platform carries both:

| Field | Values | What it means |
|---|---|---|
| `saleUnit` | 1 Hour · Full day · Per tour · Per bag · Per cart · Per delivery · Per item | What the customer is buying one of |
| `saleType` | Rental · Sale | Whether it comes back |

A **sale** is finished the moment it is paid for, so it never runs a clock and never accrues
overtime — the form hides the overtime rate and the server refuses to set one.

A kind can be sold more than one way: the brief prices a scooter both by the hour and by the full
day. The estate quotes the **entry price** — the cheapest way to buy one — and names its unit
beside it. The other ways to sell it live under **Pricing**.

### The damage penalty

Two figures, because two different things are being priced:

| Figure | Lives on | For |
|---|---|---|
| **Damage penalty** | the product | What damaging *this kind of thing* costs — the brief's 150 for a stroller, 200 for a wheelchair, 500 for a scooter |
| **Replacement value** | the individual asset | What losing *this particular one* costs. The brief's "Lost vehicle — full vehicle replacement value" is exactly this |

An asset with no replacement value of its own falls back to its kind's penalty. The tenant's
whole schedule is editable at **Tenant admin → Operating rules**.

---

## 7. Who may do what

| | Read estate | Add / suspend / price | Create or delete a kind |
|---|---|---|---|
| Activity manager, project manager | ✅ their activities | ✅ | ✅ |
| CEO / tenant admin | ✅ | ✅ | ✅ |
| HR & expenses | ✅ | ✅ | ✅ |
| Supervisor | ✅ their activities | ❌ | ❌ |
| Kiosk agent, chief captain | ✅ their activity (and scan) | ❌ | ❌ |
| Accountant, courier | ❌ | ❌ | ❌ |

An activity role sees **only its own activities** — the estate list is narrowed by
`engineFilter`, and opening a kind that belongs to someone else's activity is a 403 rather than a
row they should never have seen.

Enforced twice: `requireRole` on `routes/asset.route.ts`, and `assets.manage` in the frontend
permission table which decides whether the buttons render at all.

---

## 8. Moving one between stations

US-18 of the client's brief. An asset's **Edit** carries a station and a desk, and changing
either moves the thing:

- a station that does not run the asset's activity is refused;
- a desk that runs a different activity is refused;
- a unit a customer is currently holding is refused outright — you finish the booking first.

A vehicle **returned to the wrong station** moves itself: the return charges the tenant's
wrong-station penalty and re-homes the unit to the desk now physically holding it, because the
inventory should say where the thing actually is.

The approval code the brief asks for in front of a deliberate transfer is not built yet.

---

## 9. Deleting

- An **asset** can be deleted unless it is busy. Past bookings keep their history — they store
  the identifier, not a live join.
- A **kind** can only be deleted once it has no assets left. Its product is retired
  (`active: false`) rather than deleted, so historical orders still resolve their line names.

---

## 10. API

```
GET    /api/assets/types[?engineKind=]   kinds with counts, utilisation and price
POST   /api/assets/types                 create a kind (+ its product, + first assets)
GET    /api/assets/types/:id             one kind, its stations, and all its assets
PATCH  /api/assets/types/:id             rename / adjust capacity
DELETE /api/assets/types/:id             delete an empty kind
POST   /api/assets/types/:id/units       add N assets
PATCH  /api/assets/types/:id/price       price the kind: price, unit, sale type, deposit,
                                         damage penalty, overtime (optionally clearing overrides)
GET    /api/assets/units/:id             one asset — what a scanned QR resolves to
PATCH  /api/assets/units/:id             status, identifier, note, price override,
                                         replacement value, and the station/desk it sits at
DELETE /api/assets/units/:id             remove one asset
```

Every write is audited — either by a named action (`ASSET_KIND_CREATED`, `ASSET_UNITS_ADDED`,
`ASSET_UNIT_UPDATED`, `ASSET_TYPE_PRICED`, `ASSET_UNIT_REMOVED`, `ASSET_KIND_REMOVED`) or, failing
that, by the catch-all recorder. Nothing changes the estate without leaving a row.

---

## 11. Tests

- `backend/tests/roles.api.mjs` — the estate half of the API pass: an activity role sees only
  its own kinds, opening someone else's is a 403, the brief's catalogue is priced with its unit
  and sale type, a scooter carries its 500 damage penalty, and a unit's own replacement value
  can be set and cleared.
- `backend/tests/rules.api.mjs` — moving a unit between stations: a scooter is refused a bag
  counter, sent home to its own gate, and every borrowed unit is handed back at the end.
- `frontend/tests/assets.spec.ts` — the grid table, the three activity filters, row → detail,
  add/suspend/restore, pricing from both ends, the QR modal and its download, scanning as an
  agent, the legacy redirects, and creating a kind end to end.
