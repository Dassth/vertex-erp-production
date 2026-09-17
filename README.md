# Vertex ERP

Browser-based ERP for a printing and packaging manufacturer: product masters, order planning, order
costing, production by unit, partial dispatch and invoicing.

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router (data router) · pdfmake · Vitest.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
npm run lint     # oxlint
npm test         # vitest: engines, workflow, migration, cross-tab writes, sign-in UI and overlay focus (jsdom), PDFs, Tamil shaping
```

## Operational sequence

```
Master setup → Planning → Order Costing → Production → Dispatch → Billing
```

| Module | Route | Purpose |
| --- | --- | --- |
| Master → Products | `/master/products` | Product basics, ordered stages, processes per stage (hours + cost), materials per stage/process |
| Master → Costing | `/master/costing` | Shared material prices, pricing basis, sheet/yield/wastage settings, reusable process charges, costing defaults, order charge templates |
| Master → Customers | `/master/customers` | Company, contact, billing/delivery address, GSTIN, place of supply, payment terms, notes |
| Planning | `/planning` | Customer, product, quantity, dates, priority, options; **a production unit for every stage** |
| Costing | `/costing` | Cost one planned order, set profit/discount/tax, finalize (snapshot + production order) |
| Production | `/production` | Admin monitoring; unit users update only their assigned stages |
| Dispatch | `/dispatch` | Full or partial dispatch of completed production; each dispatch issues an invoice |
| Billing | `/billing` | Read-only invoice register, preview and PDF download, consolidated order statement |

Master → Costing (shared configuration) and the main Costing module (one order's calculation) are
separate on purpose. Planning and Costing read Master definitions; they never edit them.

## Accounts

Three administrators (`admin1@vertex.local` … `admin3@vertex.local`) with identical capabilities and
separate audit identities, plus one shop-floor account per production unit (`unit1@vertex.local` …).
Accounts ship **without passwords**: the first sign-in on an account chooses one (min. 8 characters,
stored as a salted PBKDF2-SHA-256 hash, 120,000 iterations). An administrator can reset another account's
password. Sessions are per browser tab (`sessionStorage`) and survive a reload of that tab. After signing
in, the user returns to the page they originally requested. Every action is recorded in the activity log
with the account id and name.

**What local authentication is — and is not.** It identifies who did what for the audit log and keeps
unit users out of administrator screens in normal use. It is **not** a security boundary:
- all data, including password hashes, lives in this browser profile, where anyone with access to the
  profile or its developer tools can read, change or delete it;
- whoever first signs in to an account that has no password sets that password;
- there is no rate limiting, lockout, password recovery or second factor;
- role checks run in the browser, so a determined user can bypass them.
Use a server with real authentication before handling data that must be protected.

## Data, persistence and migration

- All data is stored in `localStorage` under `vertex-erp-db-v2` (schema v2) with a `revision` counter.
- **Coordinated writes across tabs of the same browser** (`src/store/coordinator.ts`). Every save:
  1. takes an exclusive Web Locks lock shared by all tabs of the browser;
  2. reads the **latest persisted** database, not the tab's in-memory copy;
  3. applies the domain operation to it, so duplicate protection, balances and idempotency always see
     other tabs' changes;
  4. writes revision + 1 and verifies the write;
  5. notifies the other tabs over `BroadcastChannel` (the `storage` event is a backstop); they reload the
     newer revision immediately.

  Editors send the `updatedAt` of the record they loaded; if another tab or administrator saved the same
  record first, the save is refused with a **"Load latest version"** prompt instead of overwriting it.
  A save the browser rejects (quota, blocked storage) leaves both storage and the screen unchanged and
  shows an error. Without Web Locks, a short lease elects one writing tab and the others become
  read-only rather than risking lost updates.
- **Limitation — same browser only.** This synchronizes tabs and windows of **one browser profile on one
  device**. It is not multi-device or multi-user synchronization: other computers, other browsers and
  private windows see separate data. There is no server, no backup, and storage is bounded by the
  browser's quota.
- **One-time demo purge:** if the legacy `vertex-erp-db-v1` (old auto-seeded demo) exists and no v2
  database does, it is removed once and an empty v2 database is created; the purge is recorded in the
  audit log and `migrations`. A v2 database is never reset on reload or sign-in. An unreadable v2
  database is copied to a backup key before a fresh one is started.
- There is no sample data. "Clear business data" (account menu) empties business records but keeps
  accounts, company profile, costing defaults, the audit log and document counters (numbers are never
  reused), and never re-seeds anything.

## Costing rules (`src/lib/costing.ts`)

Missing prices or inputs are errors, never zero. `null` = not configured; `0` = explicitly free.

**Sheet materials** — pieces = qty × cut pieces per product; net sheets = ⌈pieces ÷ ups⌉;
wastage sheets = ⌈net × wastage %⌉ (**wastage applied once, to net sheets**); purchase quantity is the
total converted to the priced unit (sheet / pack of N / kg via GSM) and rounded **up** to the purchase
multiple. Cost = purchase quantity × price.

**Quantity materials** — net = qty × consumption per piece; wastage = net × %; purchase = total rounded
up to the multiple; cost = purchase × price.

**Processes** — hours = setup h + run h per 1,000 × qty ÷ 1,000. Run cost by basis: per 1,000, per
piece, per run hour, or fixed. Setup charge once per order. Rates come from a reusable process charge or
the process's own custom rate.

**Pricing** — total cost = materials + process run + setup + additional order charges.
- *Markup on cost*: target selling = cost × (1 + p%).
- *Margin on selling price*: target selling = cost ÷ (1 − p%).

Selling price per piece is rounded half-up to the paisa; total selling = that rate × quantity; profit =
total selling − cost. Discount (amount or % of selling) is deducted before tax; tax = taxable value ×
tax %; final customer amount = taxable + tax.

The terms are kept distinct everywhere:

| Term | Meaning | Example (1,000 pcs, markup 20 %, GST 18 %) |
| --- | --- | --- |
| Total production cost | materials + processes + setup + order charges | ₹ 9,216.00 |
| Production cost per piece | total production cost ÷ quantity, **not rounded** | ₹ 9.216 |
| Selling price per piece | cost per piece × 1.20, rounded to the paisa, **before tax** | ₹ 11.06 |
| Total selling price | selling price per piece × quantity | ₹ 11,060.00 |
| Profit | total selling − total cost (20.01 % of cost, 16.67 % of selling) | ₹ 1,844.00 |
| Tax | taxable value × 18 % | ₹ 1,990.80 |
| Final customer amount | taxable value + tax | ₹ 13,050.80 |

Production cost and profit appear only inside the ERP. Customer invoices show the selling price per
piece as the rate, plus tax and totals.

## Sheet yield ("ups") assumptions (`src/lib/yield.ts`)

A straight guillotine grid: all pieces in one orientation (the better of as-drawn and 90° rotated when
rotation is allowed), edge allowance on all four sides, a uniform cutting gap between pieces, rectangular
pieces. It is **not** a nesting/packing optimiser. For interlocking, staggered or irregular layouts
enter a ups override on the product usage; overrides must be whole numbers ≥ 1, have a reason, and not
exceed the physical area limit ⌊usable area ÷ piece area⌋. All dimensions are stored in millimetres;
materials may be entered in mm, cm or inches.

## Workflow transitions

- **Plan**: Draft → Ready for Costing (all stages need a unit; product/customer active) → In Production
  (when costing is finalized). Ready for Costing → Draft is allowed until costing is finalized. Draft /
  Ready → Cancelled.
- **Costing**: Draft → Finalized. Finalizing is idempotent: repeated confirmation returns the existing
  production order. A snapshot of customer, product definition, materials, rates, inputs and results is
  saved; later Master edits do not change it.
- **Stages**: Scheduled/Delayed → In Progress → Completed; any open → Blocked (problem) → resumed. Only the
  assigned unit's account can update a stage.
- **Cross-unit progression**: completing a stage closes earlier *same-unit* stages as "Completed by
  Progression" (after confirmation). An earlier open stage of a *different* unit blocks the stage, so no
  unit can silently complete another unit's work.
- **Order**: Active → Completed when every stage is closed; it then appears in Dispatch automatically.
- **Dispatch**: only Completed orders; whole-number quantity ≤ remaining; date not before production
  completion or the previous dispatch; company profile complete. Each confirmation carries a request id —
  a repeat returns the stored dispatch and invoice (no duplicates).

## Invoice allocation and rounding (`src/lib/billing.ts`)

Money is computed in integer paise.
- Rate = finalized selling price per piece (fixed setup and order charges are already absorbed, so they
  are allocated by quantity).
- Line amount = rate × dispatched quantity. Discount share = order discount × qty ÷ ordered qty (rounded).
  Tax = (line − discount) × tax % (rounded).
- The **final dispatch** receives order totals minus everything already invoiced, so all invoices of an
  order add up exactly to the finalized costing. A single full dispatch equals the costing totals.
- Same-state GSTINs split tax into CGST/SGST; different states use IGST; otherwise a single tax line.
- Invoice numbers: `PREFIX/FY/NNNN` (Indian financial year), from a counter that is never rewound.
- The consolidated order statement summarises issued invoices only and is explicitly not a tax invoice.
- Customer PDFs contain selling prices only — never internal cost or profit — and are rendered from the
  stored invoice snapshot.

## PDF documents (`src/lib/pdfDocs.ts`, `src/lib/pdfRender.ts`)

Invoices, order statements and the production work list are pdfmake document definitions rendered in
the browser. pdfmake and the fonts load only when a document is previewed, downloaded or exported.

- **Tamil and English** — all text uses the embedded **Noto Sans Tamil** (Regular/Bold, SIL OFL 1.1,
  `src/assets/fonts`), which also covers Latin, digits, ₹ and typographic punctuation. pdfmake renders
  through pdfkit/fontkit, which applies OpenType shaping; `shaping.test.ts` checks that its glyph output
  matches HarfBuzz for conjuncts, split vowel signs and mixed Tamil/English text. No character is
  replaced. Long names and addresses wrap; tables repeat their header row across pages.
- **Reproducible files** — the creation date is the invoice's own timestamp, so the preview and the
  downloaded file are the same bytes. Downloads use a standard `<a download>` link.
- External resources are blocked while rendering.

## Structure

```
src/lib        types, persistence/migration, costing, yield, billing, schedule, PDF documents, auth
src/domain     pure operations holding every business rule (master, planning, orderCosting,
               production, dispatch, system) — unit-tested
src/store      React store + cross-tab write coordinator (locked, revisioned, broadcast)
src/assets     embedded PDF fonts and their licences
src/features   master/{products,costing,customers}, planning, costing, production, dispatch, billing
src/components shell, shared UI, dialogs, job drawer, document preview
```

## Known limitations

- Single-browser storage and local authentication (see above); tabs of one browser are coordinated, but
  there is no server and no multi-device or multi-user operation.
- PDF fonts cover Tamil and Latin scripts. Other scripts (for example Devanagari or Chinese) would need
  an additional font.
- The pdfmake chunk (~970 kB, loaded only for PDF actions) exceeds Vite's 500 kB advisory size.
- Completed quantity equals the ordered quantity; short or over production is not modelled.
- The scheduling engine plans stages strictly in sequence within a single 9:00–18:00 Monday–Saturday shift.
