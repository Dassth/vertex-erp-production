# Tasks

## In progress
- [ ] Customer trial of the 2026-10-12 build (`VertexERP-Setup-VPP-2026-01-v2026.10.12.1255.exe` or newer) at Vertex Print Pack — one picker everywhere, month-end entries, outside units

## Next up (priority order)
- [ ] Collect feedback on size-based pricing, loans, suppliers, process allocation and price revision from the customer
- [ ] Help the customer fill each product's usual size and each material's supplier (the Materials "No supplier" filter shows what's left)

## Backlog
- [ ] Customer data to correct in the app (not changed by updates): product with HSN 0823, Gum ₹3/g, material “Ribben”
- [ ] Invoices page text still says shipments awaiting receipt are “not included” in the cumulative summary, but they now are (owner rule 2026-10-11) — reword (assumed - confirm)
- [ ] Settings → People / Machines lists have no edit from the row yet (edit is in the unit's page) (assumed - confirm)
- [ ] Same picker for smaller lists if the owner wants it: Planning unit/person/machine, order-charge templates, loan lender, HSN codes (assumed - confirm)
- [ ] Update the stale Playwright acceptance spec (`e2e/acceptance.spec.ts`) to the new product/material flows
- [ ] Supplier reports: purchases per supplier over a period (assumed - confirm)
- [ ] Loan interest / EMI schedule (today only notes) (assumed - confirm)
- [ ] Dark mode tokens (assumed - confirm)
- [ ] Remove the stray `src/domain/purchases.ts.tmp`

## Done
- [x] 2026-09-17 - Initial app: master, planning, costing, production, dispatch, billing, invoices, reports
- [x] 2026-09-17 - Server mode (PostgreSQL / PGlite), domain commands over `/api/commands`, backups
- [x] 2026-10 - Windows offline installer with PostgreSQL 17, hourly + second-copy backups, licence Worker
- [x] 2026-10-11 - Installer update fixes (pg_ctl PID file, pre-update backup as NETWORK SERVICE)
- [x] 2026-10-11 - Suspend popup reaches logged-in windows (10 s poll + refresh)
- [x] 2026-10-11 - Import a backup file from Settings; demo backup `release/VertexERP-demo-data.zip`
- [x] 2026-10-11 - Products from Excel/CSV/PDF; fill missing details from a file; export to Excel
- [x] 2026-10-11 - Drafts never lost (server drafts, resume, Unfinished cards)
- [x] 2026-10-11 - Simple material usage; Save product / Save as draft; one Add-material dialog with search + "Create new material"
- [x] 2026-10-11 - Master "Costing" renamed to "Materials"; add materials there too
- [x] 2026-10-11 - Voice-note changes: GST list, section order, one time + one rate per process, per-process materials with wastage, material forms, URD customers, custom money kinds, invoice download without delivery confirmation
- [x] 2026-10-11 - Size-based price recalculation from the product's usual size
- [x] 2026-10-11 - Revise the price of a released costing (history kept)
- [x] 2026-10-11 - Debts (loans) with date, paid-from / pays-back, PDF/Excel
- [x] 2026-10-11 - Master → Suppliers; auto-create from materials and purchases
- [x] 2026-10-11 - Planning: unit → person → machine per process
- [x] 2026-10-11 - Visibility fixes (Loan taken… button, "Bought from" section, No supplier filter); all five features cross-checked
- [x] 2026-10-11 - Project docs created (`docs/` PRD, ARCHITECTURE, RULES, DESIGN, TASKS, MEMORY)
- [x] 2026-10-12 - One picker everywhere (supplier, customer, product, material): click for the list, type to search, “+ New …” beside it — Materials, Add material, product processes, Purchase bills (supplier + items), Planning (customer + product), Money in/out (Received from / Paid to)
- [x] 2026-10-12 - Income & Expenses: “Add <month> sales & purchases…” — one confirmation adds each unpaid sales invoice and purchase bill of the month as its own entry
- [x] 2026-10-12 - Units: “Add unit…” for own units and outside units (job work), with contact, phone and address for every unit; Planning lists outside units separately and can add one from the unit list
- [x] 2026-10-12 - Product “For exact costing” panel: long material links wrap; a cut piece that doesn't fit now names both sizes and flags a sheet typed in inches as mm
- [x] 2026-10-12 - Planning: “Material prices for this order” — type a new price for this order (costing and the finalize snapshot use it), or “Save to Master too”
- [x] 2026-10-12 - Costing: tap any material or process rate to change it for this order — also while revising a released order; issues are listed while revising
- [x] 2026-10-12 - Edge allowance removed: the whole sheet is used for pieces per sheet; the field is gone from the forms (stored values kept, not counted)
- [x] 2026-10-12 - Cutting gap removed too: pieces sit edge to edge on the whole sheet (stored values kept, not counted)
- [x] 2026-10-12 - Quotations (QTN-0001…): price a product for a customer before planning — worked out from Master, round price by hand, PDF, Sent/Declined, “Customer agreed — make a plan” (costing starts at the quoted price)
- [x] 2026-10-12 - Lists: tap a row to open/edit it (suppliers, money entries, loans, purchase bills, products, materials, plans, costings, quotations); icon-only pencils became “Edit” buttons
- [x] 2026-10-14 - “Add manually” / “New plan” open a blank form (unfinished drafts are resumed from their card); a saved product no longer leaves an unfinished copy on the server; leftover copies say “already saved as PRD-…”
- [x] 2026-10-20 - End-to-end fix list (see CHANGELOG.md): GST state split + migration, loans in the balance, EMI principal/interest, screen-loading retry, typing-safe fields, job-drawer process actions, quote prices into the plan, laptop-width layout, HSN hint; all 270 tests green

## Blocked
- [ ] Cloud stored backups on Cloudflare - R2 is not enabled on the account
