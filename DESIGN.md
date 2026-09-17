# Design — Vertex ERP

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

The palette and type originate from `claude_ui_skills/design-md/linear.app/DESIGN.md`
(kept there unmodified as the source analysis). Everything below is the *project's*
system: what Vertex ERP does with it.

## Genre

`modern-minimal` — dense B2B operations tooling. Confident sans display, one
restrained accent, refined surfaces with hairline borders, composed rather than
animated.

## Macrostructure family

- **App pages** (`/master/*`, `/planning`, `/costing`, `/production`, `/dispatch`, `/billing`): **Bento Grid**.
  Variation knobs: tile count, which metric takes the 2-column span, whether the
  screen carries a board or a table below the grid.
- **Auth page** (`/login`): **Split Studio** diptych — brand panel on canvas,
  form column lifted to surface-1, hairline between. The module set inside the
  brand panel is itself a small bento.
- **Content pages**: none in this app.

**Bento cell rule.** N items → N cells. The column count must divide
`tiles + spans`, so no screen trails an empty cell. Current tuning:

| Screen | Tiles | Spans | Columns | Cells |
| --- | --- | --- | --- | --- |
| Production | 6 | Active Jobs, Delayed | 4 | 8 |
| Master · Products / Costing / Customers | 4 | — | 4 | 4 |
| Planning | 4 | — | 4 | 4 |
| Order Costing | 4 | — | 4 | 4 |
| Dispatch | 4 | — | 4 | 4 |
| Billing | 4 | — | 4 | 4 |
| Unit stage work | 4 | — | 4 | 4 |

Below `lg` every 4-column strip becomes 2 columns (N items still fill the cells).

**Navigation order is the workflow.** The pill lists Master → Planning → Costing →
Production → Dispatch → Billing left to right. Master opens a three-item menu
(Products, Costing, Customers) and every Master page repeats those three as a
sub-nav. Master → Costing is titled "Costing configuration" so it never reads as
the operational Costing module.

## Theme

Values live in `tokens.css` and in the Tailwind v4 `@theme` block at the top of
`src/index.css`, which is the source of truth. **Single light theme** — there is
no dark mode and no toggle. `color-scheme: light` on `:root`.

- `--color-paper` `#f5f6f8` — the ground; tinted toward the lavender anchor, never flat grey
- `--color-surface` `#ffffff` · `--color-surface-2` `#f1f2f6` · `--color-surface-3` `#e9ebf1`
- `--color-rule` `#e4e6ec` · `--color-rule-2` `#d2d6e0` · `--color-rule-3` `#8b919e` (controls only)
- `--color-ink` `#16181d` · `--color-ink-2` `#3b4048` · `--color-muted` `#5a616d` · `--color-faint` `#626976`
- `--color-accent` `#5e6ad2` · `--color-accent-text` `#4d57b8` · `--color-focus` `#5e6ad2`

**Depth changes medium with the ground.** The system was originally run on
Linear's near-black canvas, where elevation was lightness and drop shadows were
banned. On paper a few percent of lift is invisible, so elevation is a soft
shadow tinted toward the ink hue — a pure-black shadow over tinted paper reads
as dirt. The surface ladder also **inverts its direction of travel**: the tile
is the brightest thing on the page and the interaction states step DOWN into
grey. Hover reverses with it — a control darkens under the pointer rather than
brightening.

The one thing that does not change with the ground is the accent. `#5e6ad2` is
the identity and it carries across both themes; only the *text* cut moves, to
`#4d57b8`, because the flat lavender clears 4.7:1 on white but only 3.9:1 on
`--color-surface-3`.

## Typography

- Display: Geist, weight 600, style normal
- Body: Geist, weight 400
- Mono: JetBrains Mono, weight 400–500 — machine data only (job codes, quantities, rupee figures, timestamps)
- Display tracking: `-0.021em` headline, `-0.025em` at display sizes
- Section heads: all-small-caps, `+0.055em`, weight 600 (`.vx-smallcaps`)
- Eyebrows: mono, uppercase, `+0.08em`, `--text-2xs` — stacked **above** the
  heading, never beside it

## Spacing

4-point scale via Tailwind's own utilities. Sections do not all share one
padding: bento gap `0.75rem`, tile padding `1rem/0.875rem`, card head `1rem/0.75rem`,
dialog body `1.25rem`, page bottom `4rem`.

## Motion

- Easings: `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`, plus `--ease-in`, `--ease-in-out`
- Durations: `--dur-micro` 120ms · `--dur-short` 200ms · `--dur-long` 380ms
- Reveal pattern: one orchestrated entrance per view (`.vx-anim-up`). No
  scroll-triggered reveals anywhere — the page settles and stays settled.
- Three primitives only: `vx-enter`, `vx-slide-in`, `vx-pop`
- Reduced-motion fallback: spatial motion collapses to ≤150ms; spinners and
  skeletons keep running, slower
- Never transition `outline`, `border-width`, `padding`, or `height`

## Microinteractions stance

- Silent success. Toasts only for async effects the user cannot see.
- Hover lives inside `@media (hover: hover)` so a tap never sticks a control in
  its hover skin.
- Focus rings appear instantly and are never animated.
- Press feedback is a background shift, never a transform or a scale.

## CTA voice

- **Primary**: lavender fill, `--radius-md` 8px, 8/14 padding, white ink.
  Never pill-rounded. At most one per view.
- **Secondary**: surface-1 ground, 1px `--color-rule-2` hairline, same geometry.
- **Tertiary**: transparent ground, no border, ink text.
- **Inverse**: `--color-ink` fill, canvas ink. The loudest control available;
  at most one per screen, and never on the same screen as a primary.
- Semantic fills (`danger`, `success`) take **canvas ink, not white**. The rule
  survives the theme flip for the opposite reason: on dark the fills were bright
  and white failed on them; on light the fills are deep and canvas ink is what
  reads (`#c02626` under `--color-canvas` is 5.4:1).
- Every button ships all eight states: default · hover · focus · active ·
  disabled · loading · error · success. Loading keeps the original label and
  swaps only the fixed-width glyph slot.

## Chrome

- **Nav — N5 Floating pill.** Content-sized, detached, anchored top-left, blur
  backdrop. Modules only. It anchors left rather than centre because the
  utility cluster owns the right corner; a centred pill collided at 1280.
- **Utility cluster.** Detached, top-right: shift clock, demo entry, scope
  badge, notifications, account. The account menu also holds the owner tools.
- **Footer — Ft2 Inline single line.** One hairline rule, one line of colophon.
- Below `lg` both collapse into one cluster plus a module sheet.

## What pages MUST share

- The wordmark and its lavender square.
- The accent and its placement — brand mark, primary CTA, focus ring, active
  nav item, link emphasis. Never a section background or a card fill.
- Geist display + body, JetBrains Mono for machine data only.
- The CTA voice above: 8px radius, the four variants, the eight states.
- The head rhythm: mono eyebrow stacked above a display title, small-caps for
  card and dialog heads.
- One containment layer. Tiles sit on the canvas; they do not sit inside a card
  that sits inside a panel.

## What pages MAY differ on

- Tile count, span placement, and column count inside the Bento family.
- Whether the screen carries a board, a table, or a form below the grid.
- Section padding — sections are deliberately not all padded alike.

## Per-page allowances

- App pages MUST NOT use enrichment. Function carries the page.
- The auth page MAY carry the module bento as its only enrichment. No
  illustration, no imagery, no background effect.
- Print output is already ink-on-white, so `@media print` now only drops the
  chrome (`.vx-no-print`) and flattens the paper to pure white for photocopying.

## Documented deviations from the source DESIGN.md

1. **Four production status hues survive.** The source forbids a second
   chromatic accent but scopes that to marketing. Completed / approaching /
   delayed / running are load-bearing on a shop floor. Every one is paired with
   a glyph — colour is never the only signal. Status colour lives in the dot and
   the word; the badge ground stays neutral except for warn and risk.
2. **`--color-rule-3` is its own value, not the source's `hairline-tertiary`.**
   Control boundaries must clear 3:1 against their surface (WCAG 1.4.11). On
   paper that lands at `#8b919e`, 3.2:1 against white — the lightest a real
   input border may go.
3. **The focus ring is solid, not 50% opacity.** The source draws it at 50%,
   which composites too faintly to clear the 3:1 a focus indicator requires. It
   runs solid on the flat lavender instead: 4.7:1 against white, 3.9:1 against
   the deepest surface.
4. **Spacing runs at operations density.** The source's 96px section rhythm and
   24–48px card padding are marketing-scale. The 4px base unit and the radius
   ladder are adopted exactly; the paddings are not.
5. **Geist rather than Inter.** The source sanctions either as a substitute for
   Linear's undistributed cut. Geist is the one the taste skill does not list as
   an AI tell.
6. **The theme runs light.** The source is explicit that its system is dark-only
   ("Don't ship a light-mode marketing page"). This is the largest departure and
   it was a direct product decision, not a drift. What carries over: the lavender
   accent and its placement rule, the radius ladder, the hairline discipline, the
   single-family type voice, and the four-step surface ladder. What necessarily
   changes: the medium of depth (shadow, not lightness), the ladder's direction
   of travel, the hover direction, and every ink and status value, all re-cut and
   re-measured against paper.

## Exports

### tokens.css

The full token block lives at `tokens.css` in the project root — the
framework-free export of the `@theme` block in `src/index.css`. Keep the two in
step; `src/index.css` is authoritative and carries the reasoning.

### Tailwind v4 `@theme`

`src/index.css` lines 36–190. This is what the app actually compiles against.
