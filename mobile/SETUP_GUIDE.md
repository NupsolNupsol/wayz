# LockerFlow Mobile — setup guide

The mobile client for the LockerFlow platform. It talks to the existing API; there is no separate
backend here.

Two devices are in scope, and they are both Android:

| Device | Who uses it | Layout |
|---|---|---|
| **Sunmi V3 MIX** (10.1") | Agents and cashiers at the counter | Wide — two columns, split views |
| **Sunmi V2s** (5.45") | Delivery agents on the road | Tall — one column, large targets |

---

## 1. Running it

```bash
cd mobile
npm install
npm start            # then press "a" for Android, or scan the QR with Expo Go
```

### Which Expo SDK, and why not the newest

This project is pinned to **Expo SDK 56** (React Native 0.85.3, React 19.2.3) so it opens in the
**Expo Go build on the Play Store**. SDK 57 is the newer stable release, but Expo Go ships to the
store behind it — scanning a 57 project on a store-installed Expo Go fails with *"this project
requires a newer version of Expo Go"*.

Check what your Expo Go supports before changing this: open Expo Go and read its version, or read
the SDK named in that error. The store client for SDK 56 is Expo Go **56.0.4**.

To move the whole project to a different SDK, change one number and let Expo align the rest:

```bash
npx expo install expo@~57.0.18 --fix   # or any other SDK line
npx expo-doctor
```

`--fix` is what keeps `react-native`, `react`, `expo-router` and every `expo-*` package on the same
line. Do not bump them by hand.

**One known issue that comes with staying on 56:** `expo-doctor` reports the Hermes V1 memory
regression (fixed in React Native 0.86.2, which arrives with SDK 57). It affects memory use, not
correctness, and the only fix is the SDK that Expo Go cannot yet open. Once the store ships Expo
Go 57, run the `--fix` command above and the warning goes away.

| Command | What it does |
|---|---|
| `npm start` | Metro dev server |
| `npm run android` | Dev server, opening on a connected device or emulator |
| `npm run web` | Runs in a browser — handy for quick layout work |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run doctor` | `expo-doctor` — versions, config and peer-dependency checks |

### Pointing it at the API

A device on the shop floor cannot reach `localhost` — that is the device itself. Copy
`.env.example` to `.env` and set the address of the machine running the API:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000/api
```

Find the address with `ipconfig` (Windows) or `ifconfig` (macOS, Linux). The welcome screen shows
whether the device can reach the API, so a wrong address is obvious immediately.

Anything prefixed `EXPO_PUBLIC_` is inlined at build time and is therefore **public** — never put a
secret there.

---

## 2. The structure

```
mobile/
├── app/                      # Routes. Expo Router turns files here into screens.
│   ├── _layout.tsx           # Providers: React Query, safe areas, gestures, global.css
│   └── index.tsx             # The welcome screen
├── src/
│   ├── api/
│   │   ├── client.ts         # One axios instance, auth header, 401 handling, envelope helpers
│   │   └── queryClient.ts    # React Query defaults tuned for a flaky shop-floor network
│   ├── components/ui/        # Screen, Card, Button, StatusPill — the shared visual vocabulary
│   ├── hooks/                # React Query hooks and device helpers
│   │   ├── useDeviceClass.ts # Handheld or tablet, decided by width, not by platform
│   │   └── useHealth.ts      # Example query: can this device reach the API?
│   ├── store/
│   │   ├── session.store.ts  # Who is signed in; token persisted in SecureStore
│   │   └── ui.store.ts       # Theme and layout preferences
│   └── types/                # Shared domain types, mirroring the API
├── global.css                # Tailwind directives, imported once in the root layout
├── tailwind.config.js        # Content paths + the platform palette
├── babel.config.js           # babel-preset-expo with NativeWind's jsxImportSource
└── metro.config.js           # withNativeWind, pointed at global.css
```

**Routes hold no logic.** A file in `app/` composes components and hooks; the fetching lives in
`src/hooks`, the transport in `src/api`, the shared state in `src/store`. That keeps a screen
readable and makes each piece testable on its own.

**`src/` is aliased to `@/`**, so imports read `@/components/ui/Card` from anywhere.

---

## 3. State: React Query or Zustand?

Two kinds of state, two tools, no overlap.

**TanStack React Query — anything the server owns.** Bookings, deliveries, the customer, the
catalogue. It is a cache of somebody else's data, so it needs fetching, caching, retries,
invalidation and staleness — all of which React Query already does. The rule: if a screen shows
something the API knows about, it comes from a hook in `src/hooks`.

Defaults chosen for the shop floor (`src/api/queryClient.ts`):

- reads retry twice — a handheld drops off wifi constantly;
- writes never retry — an operator must never discover a duplicate payment they did not make;
- 30-second stale time — enough to keep screens quiet without showing yesterday's numbers.

**Zustand — anything only this device owns.** Which account is signed in, the chosen theme, UI
toggles. Small, synchronous, no server round trip. Putting this in React Query would be pretending
it is remote; putting server data in Zustand would mean hand-writing the cache invalidation React
Query gives for free.

The token is the one piece that outlives the process, so it is written to **expo-secure-store** and
read back on launch by `restore()`. The axios interceptor reads it through `currentToken()`, which
is why the API client needs no React context.

---

## 4. Styling

NativeWind 4 gives Tailwind classes on React Native primitives:

- `tailwind.config.js` scans `./app` and `./src` and carries the platform palette (`brand`,
  `navy`, `muted`, `line`, `canvas`) so the app matches the web workspace;
- `global.css` holds the three Tailwind directives and is imported once, at the top of
  `app/_layout.tsx`;
- `metro.config.js` wraps the Expo config in `withNativeWind`, which compiles the CSS;
- `babel.config.js` sets `jsxImportSource: 'nativewind'` so `className` works on RN components;
- `nativewind-env.d.ts` gives TypeScript the `className` prop.

Layouts branch on `useDeviceClass()` rather than on `Platform`, because both form factors are
Android. Anything 600dp or wider on its shortest side is treated as a counter tablet.

---

## 5. Verification

Run all three before pushing:

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run doctor        # expo-doctor: 21 checks
```

To prove the whole toolchain compiles — Babel, Metro, NativeWind, the router — build a bundle
without needing a device:

```bash
npx expo export --platform android --output-dir /tmp/lf-export
```

This scaffold was verified with all of the above, plus a dev-server bundle fetch and a check that
the served manifest advertises `exposdk:56.0.0`, on Expo SDK 56 / React Native 0.85.3 / React 19.2.3.
`expo-doctor` passes 21 of 22 checks; the one failure is the Hermes note described in §1.

---

## 6. What is deliberately not here yet

Sign-in, protected routes, the agent and courier workspaces, offline queueing, and the Sunmi
printer and scanner integrations. The foundation is meant to stay small enough to read in one
sitting; features get added on top of it, not woven into it.
