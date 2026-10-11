# Design System

Source of truth: tokens in `src/index.css` (`@theme`), component classes `vx-*`, components in `src/components/ui.tsx`. Never invent new colors, fonts or spacing.

## Brand feel
Calm, precise, factory-practical, trustworthy.

## Colors (tokens: name - hex - usage)
| Token | Hex | Usage |
|---|---|---|
| canvas / paper | #f5f6f8 | App background |
| surface | #ffffff | Cards, modals, tables |
| surface-2 / -3 / -4 | #f1f2f6 / #e9ebf1 / #e1e4ec | Hover, inset, pressed |
| hairline / hairline-strong | #e4e6ec / #d2d6e0 | Borders, dividers |
| ink / ink-2 | #16181d / #3b4048 | Main and secondary text |
| muted / faint | #5a616d / #626976 | Captions, meta |
| accent | #5e6ad2 | Primary buttons, links, focus |
| accent-hover / accent-text | #4f5ac2 / #4d57b8 | Hover; accent text on white |
| accent-wash / accent-edge | #eef0fc / #c8cdf2 | Selected rows, info panels |
| ok (+wash/edge) | #0f7a3d | Done, cleared, saved |
| warn (+wash/edge) | #8a5a00 | Missing details, attention (amber) |
| risk (+wash/edge) | #c02626 | Errors, delete, overdue |
| live (+wash/edge) | #0e6d8c | In progress |
| chart-1…6 | #4d57b8 #0e6d8c #0f7a3d #8a5a00 #c02626 #7340b8 | Charts (color-blind friendly order) |

Light theme only today (no dark tokens in `index.css`) (assumed - confirm whether dark mode is wanted).

## Typography
- Font: Geist (display + sans); JetBrains Mono for codes (`vx-code`, e.g. DBT-0001).
- Sizes: 2xs 11px (mono labels), xs 12px (captions), sm 13px (secondary UI), base 14px (tables, controls), md 16px (body, card titles), lg 20px (section titles), xl 24px (page titles), 2xl 31px (KPIs), 3xl 40px (hero figure).
- Numbers in tables: `tabular-nums`, right-aligned.
- Section headings: `vx-smallcaps`.

## Spacing & radius scale
- Spacing: the Tailwind 4px scale (gap-1 … gap-6, px-3 py-2 for inline notes).
- Radius: xs 4px, sm 6px, md 8px, lg 12px, xl 16px; nested radii get smaller inward.
- Shadows: whisper (cards), lift (raised), pop (menus), overlay (modals), drawer, rail.

## Components (states and variants)
- **Button:** primary / secondary / ghost / danger; sizes sm / md; a `loading` spinner keeps the label; the `icon` prop.
- **IconButton:** must have a `label` (aria-label).
- **Field + Input / Select / Textarea / NumberInput:** label, hint, required, inline `error`, `aria-invalid`.
- **Card + CardHead:** title, subtitle, icon, actions.
- **Modal / Drawer:** title, subtitle, icon, footer actions; focus trapped; overscroll contained.
- **ConfirmDialog:** `tone="danger"` for deletes.
- **StatTile / StatStrip:** KPI tiles that act as filters (`active`).
- **Badge:** tones (amber = not set / missing).
- **EmptyState:** icon, title, a message giving the next step.
- **Tables:** `vx-th`, `vx-td`, `vx-row`, `vx-td-wrap` for long text; wide tables scroll horizontally inside the card.
- **Toasts:** `pushToast({ title, message, level })`, with a polite aria-live region.
- **Amber "missing details" panel:** shows what to fill for exact costing; never blocks saving.

## Layout & breakpoints
- `AppShell` with a left rail; Master sub-nav: Products, Materials, Suppliers, Customers.
- Page = `PageHeader` (title, subtitle, actions) → StatStrip → Cards.
- Tailwind breakpoints sm 640 / md 768 / lg 1024 / xl 1280; forms use `sm:grid-cols-2`.
- Main target is a desktop/laptop at the factory; it must still work at 375px.

## Motion
- Easing: `--ease-out` cubic-bezier(0.16,1,0.3,1) for entrances; `--ease-in` and `--ease-in-out` as needed.
- `vx-anim-up` for card entrance; only `transform` and `opacity` are animated.
- `prefers-reduced-motion` turns animations off.

## Accessibility
- A visible `:focus-visible` ring in the accent color (`vx-focus`).
- Status is never shown by color alone (text like "Cleared" or "Not set" goes with the color).
- Hit targets ≥24px (≥44px on touch); inputs are 16px on mobile.
- Native `<button>`, `<a>`/`<Link>`, `<label>`, `<table>` before ARIA.
- Full list: `AGENTS.md`.

## Reference inspirations
Linear-style calm UI (accent #5e6ad2) (assumed - confirm).
