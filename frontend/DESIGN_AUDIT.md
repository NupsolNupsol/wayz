# DESIGN_AUDIT.md — Extracted from nupsolDaily (CoreUI Pro / navy theme)

> nupsolDaily is the authoritative visual source. Tokens below are extracted verbatim from its
> source (`_custom.scss`, `AppSidebar.css`, `AppHeader.css`, `Login.css`). The new app is Tailwind,
> so these are reproduced as CSS variables + Tailwind theme extensions to look like the same product.

## 1. Brand palette (`_custom.scss :root`)
| Token | Value | Use |
|-------|-------|-----|
| `--nup-dark-blue` | `#10214b` | Primary navy (text, avatar) |
| sidebar navy | `#102a5a` | Sidebar background |
| `--nup-mid-blue` | `#204897` | Secondary button / links |
| login brand | `#0f214a` / `#1a3470` | Login gradient, primary button |
| accent blue | `#4f8ef7` / `#3e6dd7` | Focus ring, active accent |
| `--nup-light-blue` | `#aab9cf` | Muted dots/lines |
| `--nup-yellow` | `#f9b115` | Warning / pending |
| `--nup-green` | `#249542` | Success / active |
| `--nup-red` | `#db5d5d` (badge `#ef4444`) | Danger / end-selling |
| `--nup-gray` | `#6b7785` | Secondary text |
| body bg | `#f8f9fa` (cui-tertiary-bg) | Page background |
| surface | `#ffffff` | Cards |

## 2. Typography
- **No custom font.** CoreUI/Bootstrap default stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. FontAwesome 4.7 loaded via CDN (icons). We use system stack + lucide-react icons.
- Welcome/brand: 18px / 700. Login greeting 26px / 800. Nav link 14px / 500 (active 600). Body 13.5–14px. Labels uppercase 11.5px / 700 letter-spacing .7px.

## 3. Sidebar (`AppSidebar.css`)
- Fixed floating card: `top/left/bottom: 8px`, `height: calc(100vh - 16px)`, **width 274px** (wrapper reserves ~282px), **collapsed 80px**.
- Background `#102a5a`, **border-radius 32px**, shadow `0 4px 24px rgba(15,33,74,.18)`, `overflow:hidden`.
- Header 80px, brand logo wrap 44×44 white radius 12px, brand name 18/700 white.
- Nav link: padding `12px 16px`, radius `14px`, color `rgba(255,255,255,.8)`, gap 14px, icon 20px.
- Hover: bg `rgba(255,255,255,.12)`. **Active: bg `rgba(255,255,255,.2)`, white, 600, + right 4px white indicator bar.**
- Collapsed active: white pill 54px, navy icon. Group labels + chevron (rotate 90 open). Footer collapse button.
- Mobile (≤991px): off-canvas `translateX(-110%)`, backdrop `rgba(0,0,0,.45)`.

## 4. Header (`AppHeader.css`)
- Fixed, **height 80px**, bg `#f8f9fa`, `padding-left: sidebar-w + 24px`, right 24px.
- Left: welcome text 18/700 `#102a5a` (hidden ≤1100px). Search: flex 0 1 300px, h38, radius 10, bg `#f7f8fa`, border 1.5px `#e8ecf0`, icon left. Focus border `#0f214a`.
- Right controls: icon buttons (7×9 padding, radius 8, `#6b7280`), notification red dot badge `#ef4444`, 1px divider, user pill: 34px navy avatar circle white initials, name 13/600 navy, role 11 gray, chevron. Dropdown 160px white radius 10 shadow.

## 5. Login (`Login.css`)
- Centered, radial gradient bg `#dce8ff→#f0f4ff→#e8edf8`. Card max 1000px, radius 28px, split flex.
- Left panel: navy gradient `linear-gradient(145deg,#0f214a,#1a3470,#0d2860)`, animated rings, logo circle 110px glass. h1 32/800.
- Right form: max 340px. Input h48 radius14 bg `#f4f6fb` border 1.5px `#c8d3e8`, focus navy + ring `rgba(79,142,247,.15)`. Button h50 radius14 bg `#1a3470` hover `#1f3e87`.
- ≤768px stacks column-reverse.

## 6. Surfaces / components
- Cards: white, radius ~16px (CoreUI `.card` + custom `.do-card`), subtle border `#e8ecf0`, shadow soft.
- Tables: header gradient in dark; light = white with `#e8ecf0` borders, striped option. Row hover subtle.
- Inputs: radius 10–14, border `#c8d3e8/#e8ecf0`, focus navy border + blue ring.
- Toasts: react-toastify; custom motivational-toast surface card + shadow.
- Radii scale: 8 (icon btn) / 10 (input, dropdown) / 14 (nav, primary input/btn) / 16 (card) / 28–32 (login card, sidebar).
- Dark mode present (deep navy `#0d1b2e` bg, `#142238` surface) via `[data-coreui-theme='dark']`. We reproduce light + dark.

## 7. Layout metrics
- Wrapper: `margin-left: sidebar-w`, `padding-top: 80px`. Content padding ~24px, gaps 16–24px.
- Breakpoints: mobile ≤991 (sidebar off-canvas), header shrink ≤1100/≤768/≤500.

## 8. Tailwind mapping (implemented in `src/styles`)
- CSS variables `--nup-*`, `--lf-*` on `:root` + `.dark`.
- `tailwind.config` extends `colors.navy/brand/accent/success/warning/danger/muted`, `borderRadius`, `boxShadow.card/sidebar`, `spacing.sidebar(274px)/header(80px)`.
- Components (`Sidebar`, `Header`, `Login`, `Card`, `Button`, `Badge`, `Table`, `Modal`, `Drawer`, `Toast`) recreate the class behavior above with Tailwind utilities + a small `components.css`.
