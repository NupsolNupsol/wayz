# LockerFlow — Agent POS (MVP demo)

An **employee-operated, multi-engine Web POS** for the LockerFlow platform. Every transaction is
performed by an authenticated **Agent** — there is **no customer application**. Visual system mirrors
**nupsolDaily** (CoreUI Pro navy); operational workflows follow the **Wazen POS** evidence and the
specification documents in `reference-product-analysis/specifications/`.

Frontend-only: all services are typed mocks (Promises + latency); state persists to `localStorage`.
No backend, database, or external APIs are created or called.

## Run it

```bash
cd lockerflow-agent-pos-frontend
npm install
npm run dev
```

Then open **http://localhost:5175/** in your browser (port is fixed via `strictPort`).

> Port 5173 (root simulation) and the operations frontend are left untouched.

## Demo credentials

| Role            | Email                          | Password      |
|-----------------|--------------------------------|---------------|
| Agent · WAYZ    | `agent.wayz@lockerflow.demo`   | `Agent@123`   |
| Agent · WIQAR   | `agent.wiqar@lockerflow.demo`  | `Agent@123`   |
| Manager · WAYZ  | `manager.wayz@lockerflow.demo` | `Manager@123` |

The login screen has one-click quick-fill buttons for each account. Auth is a **frontend-only mock**
(no production security implied).

## Suggested demo path (Shop & Drop — the deepest flow)

1. Log in as **Agent · WAYZ** → Dashboard.
2. Sidebar → **Shop & Drop** → **New transaction**.
3. Pick customer *Ahmed* → keep **3 bags** → **Capacity & plan** (3 bags pack into **1** L compartment).
4. **Check availability & hold** (ResourceHold *before* payment) → verify OTP → **Confirm payment** (booking confirmed, **timer not started**).
5. **Reserve recommended unit** (AssetReservation on a specific locker) → **Print bag labels** (one unique barcode per bag).
6. **Scan compartment** + scan each bag → **Confirm Storage** → the storage **timer starts here**.
7. **Retrieval** tab → search the booking → scan bags out (wrong bag is rejected; completion is blocked until all are out) → **Confirm handover** → the compartment is released.

## Scripts

| Command             | Purpose                              |
|---------------------|--------------------------------------|
| `npm run dev`       | Dev server on 5175                   |
| `npm run build`     | Strict TypeScript + production build |
| `npm run lint`      | ESLint (flat config), zero warnings  |
| `npm run test:e2e`  | Playwright suite (16 tests)          |
| `npm run preview`   | Preview the production build on 5175 |

## Reset

Profile → **Reset demo data** restores all seeded tenants, assets, and transactions.

See `PROGRESS.md`, `tests.json`, and the `*_AUDIT.md` / `SOURCE_TRACEABILITY.md` documents for detail.
