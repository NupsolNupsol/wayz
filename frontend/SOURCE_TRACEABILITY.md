# SOURCE_TRACEABILITY.md — feature → evidence map

| Feature / module | Spec docs | Video frames | nupsolDaily source |
|---|---|---|---|
| Agent-only web POS, no customer app | 01, 03, 15, 19, 20 | 001–052 (all agent-driven) | — |
| Multi-tenant hierarchy + station scope | 04 §2, 06, 19 §4 | 006 (tenant/branch header) | AppHeader context area |
| Roles (AGENT full, MANAGER stub, 13 extensible) | 06, 19 §4 | — | AppSidebarNav role filter |
| Login (split navy card) | 02 S1 | 001 | `views/pages/login/Login.css/.js` |
| App shell (sidebar + header) | 13 §1, 14 §1 | 002/006 (tabs→sidebar) | AppSidebar, AppHeader, DefaultLayout |
| Dashboard | 13, 19 §7 | 052 (report) | `views/dashboard` |
| POS engine/product grid + cart split-view | 03 §2, 09, 14 §1 | 006, 010, 013 | CoreUI cards/grid |
| Customer find/create + OTP | 02 S7/8, 03 §3, 16 §2.3 | 010, 013 | react-select patterns |
| Payment (Cash/Mada, split), no timer start | 09, 16 §2.3 | 028, 030 | CoreUI forms/modal |
| ZATCA-style receipt (printable) | 02 S14/15, 09 §3 | 032, 035 | qrcode.react |
| **Shop & Drop capacity/PackingPlan** | 04 §3/4, 07 §2, 08 §2 | 006 (sizes) | — |
| ResourceHold (pre-pay, by type) | 04 §4, 05 §3, 08 §2.1, 16 §2.1 | — | — |
| AssetReservation (post-pay, specific unit) | 04 §5, 08 §2.3 | — | — |
| 1 bag = 1 BagItem = 1 barcode | 07 §2.3, 04 §6 | 035 (barcode sticker) | — |
| Confirm Storage starts timer | 04 §5, 05 §4, 08 §2.4, 16 §2.4 | — | — |
| Active session / overtime / escalation | 04 §5, 08 §4 | — | Active session card (14 §2.2) |
| Retrieval + scan-out + missing/wrong bag | 05 §4, 08 §5, 12 §3.4/3.5 | 040, 045 (deliver/OTP) | — |
| Compartment state machine + release | 05 §7 | — | `/assets` digital twin (13) |
| Reassignment w/ reason + audit | 08 §3, 12 §3.3 | — | — |
| Shift close / blind count / variance | 10 | 050, 052 | `views/dashboard` report |
| Incidents & risk | 12, 05 §8 | — | modals |
| Mobility engines ×7 (PROPOSED policies) | 08b §2, 07 §3, 09 §1 | 002/006 (categories) | policy chips |
| Lagoon | 08b §3 | — | — |
| COTE restaurant | 08b §4, 06 §11-13 | — | `/assets/floorplan`, KDS (13) |
| Ana'am | 08b §5 | — | — |
| Porter (feature-flagged OFF) | 07 §4, 11, 18 §3 | 003 (delivery to car product) | — |
| Online-only connectivity warning | 04 §1, 17, 19 §2 | — | — |
| Manual access (no smart-lock) | prompt §final_clarifications 2 | — | — |
