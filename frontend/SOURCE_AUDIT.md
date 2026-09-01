# SOURCE_AUDIT.md — LockerFlow Agent POS

> Evidence audit performed before implementation. Every claim below is traced to a source.
> Date: 2026-08-03

## 1. Evidence inspected

### Specifications (`reference-product-analysis/specifications/`) — all 21 read in order
- **01 Repository Findings** — Agent-facing web POS is the MVP. No customer app. 11 engines. React/Vite/TS strict.
- **02 Video Screen Inventory** — 52-frame Wazen POS walkthrough: Login → Home catalogue → Station select → Products → Cart → Client data + OTP → Shipping → Payment (Cash/Mada) → Print (ZATCA invoice + barcode) → Deliver tab (OTP handover) → Delivered → Shift close (Achievement report).
- **03 POS Live Analysis** — Bottom tabs Home/Deliver/Delivered/Reports. Agent-driven OTP paradigm confirmed (no customer app). Shop&Drop sizes S/M/L/XL/XXL (30/40/60/70/80 SAR) + Delivery to Car (40).
- **04 Domain Model** — Full entity catalogue: hierarchy Platform→Tenant→Site→Zone→Engine→Station→AssetArea→AssetUnit; CatalogueProduct (billingModel enum), AssetType (capacity), AssetUnit (9 statuses), PackingPlan, ResourceHold, AssetReservation, StorageSession (timer fields), BagItem, BarcodeLabel, CustodyEvent.
- **05 State Machines** — Booking, ResourceHold, StorageSession, BagItem, Custody, Compartment, Incident lifecycles (mermaid).
- **06 Role Permission Matrix** — 13 roles. Agent scope: `/pos`, `/cart`, `/operations/*`, `/assets`, station-only. Sensitive actions: Create Booking, Hold Capacity, Capture Deposit, Confirm Storage/Start Operation.
- **07 Business Rules** — Physical packing ≠ commercial billing. Multiple bags per compartment allowed; multiple compartments per order allowed. Billing models PER_BAG / PER_COMPARTMENT / PACKAGE / DURATION_BASED. **Invariant: 1 bag = 1 BagItem = 1 unique barcode.** Mobility rules PROPOSED/CONFIGURABLE. Delivery-to-Car behind `deliveryToCarEnabled=false`.
- **08 Shop & Drop Workflow** — Golden flow: Availability+ResourceHold → Quote+OTP+Payment (no timer) → AssetReservation (agent lease on specific unit) → Physical scan → Confirm Storage (timer start) → Overtime → Retrieval → chargeableStorageEndedAt. Reassignment flow with mandatory reason + audit.
- **08b Multi-Engine Specs** — 7 mobility products policy matrix (deposit/duration/capacity/etc, all PROPOSED). Lagoon, COTE, Ana'am workflows.
- **09 POS & Payments** — VAT-inclusive 15%. Deposit auto-line (untaxed, refundable). Cash/Mada split payments. ZATCA invoice. Refund/Damage capture.
- **10 Reconciliation** — Blind cash count → match/RECONCILING → Supervisor resolution.
- **11 Porter** — Feature-flagged, Agent-initiated only. Custody LOCKER→AGENT→PORTER→CUSTOMER.
- **12 Incidents & Risk** — Condition inspection, OTP bypass (supervisor override), reassignment, missing bag (blocks completion), wrong bag (rejects scan).
- **13 Screen Inventory** — Route map per engine + Phase 2 intelligence (out of scope).
- **14 UI Component Library** — Responsive sidebar, split-view POS 70/30, 44px touch targets, OTP 4-square input, barcode wedge input, inspection form, modals (centered desktop / bottom-sheet mobile).
- **15 Wazen Gap Analysis** — **Wazen = functional workflow source; nupsolDaily = visual source.** Gaps: form factor, physical asset assignment, stateful sessions/deposits.
- **16 Data & API Contracts** — Mock service boundaries: catalogue/availability, order/cart, checkout (processPayment never starts timer), asset assignment (confirmStorage/startOperation start timers), return/handover.
- **17 Offline & Sync** — DEPRECATED. Online-only MVP; blocking connectivity warning.
- **18 Open Questions** — Visual priority RESOLVED (Wazen functional / Nupsol visual). Porter flag. Hardware.
- **19 Master Spec** — Consolidated blueprint.
- **20 Claude Code Prompt** — Original prompt (superseded by the active task prompt).

### Video frames (`evidence/video-frames/VIDEO_001–052.png`)
Opened representative frames across every workflow segment (login 001, catalogue 006, cart 010, client+OTP 013, payment 028, invoice 035, shift-close 052) plus the textual frame inventory (doc 02/03). Grouped into: Login, Catalogue/Home, Station-selection shift-start, Product grid, Cart, Client data + OTP, Shipping, Payment sheet, ZATCA receipt, Deliver/handover, Delivered, Shift close report.

### nupsolDaily (`nupsolDaily/nupsolDailyWeb`)
CoreUI Pro v5 (Bootstrap 5.3) React admin template. Fully inspected: package.json, `scss/style.scss`, `_theme.scss`, `_custom.scss` (Nupsol palette CSS vars + dark mode), `components/AppSidebar.css`, `AppHeader.css`, `views/pages/login/Login.css`, `_nav.js`, `AppSidebarNav.js`, `index.html`. See DESIGN_AUDIT.md for extracted tokens.

## 2. Source conflicts (resolved per prompt "latest decisions" priority)

| # | Conflict | Older spec says | Active prompt says | Resolution |
|---|----------|-----------------|--------------------|------------|
| C1 | Target directory | Docs 19/20: `lockerflow-operations-frontend/` | New `lockerflow-agent-pos-frontend/` | **Prompt** — new folder; operations-frontend left untouched |
| C2 | Dev port | Docs 19/20: `5174` | `5175`, strictPort | **Prompt** — 5175 |
| C3 | Roles this phase | Doc 06: 13 roles selectable at login | AGENT focus + minimal MANAGER; extensible for 13 | **Prompt** — implement AGENT fully, MANAGER stub, typed model keeps all roles |
| C4 | i18n / RTL | Docs 19/20: EN + AR RTL required | Prompt silent; English employee workspace | English primary UI; RTL noted as a documented limitation (not required by active prompt) |
| C5 | "Force Asset Unlock" | Doc 06 supervisor action | Prompt: replace with "Approve supervised manual access…" | **Prompt** — manual-access language, no smart-lock |
| C6 | Customer OTP for identity | Wazen uses SMS OTP | Prompt: mocked frontend-only | OTP simulated (agent reads a shown code); no real SMS |

## 3. Firm requirements distilled
- Agent-only, employee-operated, online-only, mocked services (Promises + latency), localStorage persistence, Reset Demo action.
- Multi-tenant isolation: WAYZ + WIQAR tenants; agents scoped to tenant+site+station+engines.
- Shop & Drop is the deepest workflow and must honor: capacity packing (bags↔compartments many-to-many), 1-bag-1-barcode invariant, ResourceHold(pre-pay, by type) vs AssetReservation(post-pay, specific unit), Confirm-Storage-starts-timer, retrieval verifies every bag, wrong/missing bag handling, compartment release on completion.
- Payment never starts operational timers.
- Mobility/Lagoon/COTE/Ana'am functional with PROPOSED/CONFIGURABLE policy flags (never presented as confirmed).

## 4. Assumptions (marked, minimal)
- OTP is simulated: the mock service returns the code and the UI reveals it ("demo OTP"), the agent types it back. (Wazen shows real SMS; prompt mandates frontend-only.)
- Barcodes rendered as Code128-style visual + value; QR via a QR component. Print simulated with a print-styled modal / `window.print()`.
- Demo "now" clock and accelerated timers where useful for demonstration, clearly labeled.
