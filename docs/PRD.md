# PRD - Vertex ERP

## Problem
- Vertex Print Pack (a box/printing maker in Sivakasi) runs products, costing, planning, production, dispatch, billing and money on paper and spreadsheets.
- Costing is slow and error-prone: material sizes, wastage, process time and rate are worked out by hand for every order.
- Product data comes from customers as Excel, CSV or PDF files with gaps, and it has to be retyped.
- The factory PC is often offline, so a cloud-only tool cannot be relied on.

## Target users
- **Owner / full admin:** sets up masters, approves costings, sees money and reports.
- **Operations admin:** planning, costing, production follow-up, dispatch.
- **Billing admin:** invoices, purchase bills, receipts, GST reports.
- **Unit user (shop floor):** sees only their unit's jobs and updates stage progress.
- Users are not technical; the UI is in plain English, and the owner speaks Tamil.

## Goals (measurable)
- A costing is finalised from a plan in under 5 minutes (assumed - confirm).
- Zero data loss: no update, import or edit ever deletes customer data, and drafts survive closing the app.
- Works fully offline on one Windows PC; hourly backups plus a second copy.
- Importing 80+ products from a customer file needs no retyping; missing details are flagged, not blocking.

## Core features (MVP)
- [x] **Master → Products:** basic details, materials (with wastage), stages → processes (one time + one rate each, per-process materials). Draft or save. Import/fill from Excel/CSV/PDF; export to Excel.
- [x] **Master → Materials:** sheet / roll / ready-made / other forms, price, supplier ("Bought from"), usage summary.
- [x] **Master → Suppliers:** contact details; auto-created when a new name is typed on a material or purchase.
- [x] **Master → Customers:** registered (GSTIN) or unregistered (URD).
- [x] **Planning:** quantity, size (scales material cuts and price from the product's usual size), process → unit → person → machine allocation.
- [x] **Costing:** live cost per piece, missing details shown in amber and accepted with a tick, finalise (release), then revise the price after release (history kept).
- [x] **Production / Units:** job stages per unit, progress, machines and people.
- [x] **Dispatch → Billing / Invoices:** GST tax invoice, downloadable without waiting for delivery confirmation; purchase bills.
- [x] **Income & Expenses:** money in/out, custom kinds, loans (debts) with paid-from and pays-back links, PDF/Excel downloads.
- [x] **Reports:** GST, invoice register, customer history, exports.
- [x] **Settings:** backup, restore, import a backup file, company details, users.
- [x] **Licence:** online check with a suspend popup that appears even while logged in; view-only mode when suspended.
- [x] **Windows installer:** one EXE that installs PostgreSQL 17 and the app, and keeps data on update.

## Out of scope
- Multi-company / multi-branch (assumed - confirm).
- E-way bill and e-invoice portal upload (assumed - confirm).
- Mobile app; payroll; full double-entry accounting (assumed - confirm).

## User flows
1. Products (manual or from file) → Materials and Suppliers filled → Customers.
2. New plan: pick customer + product → size → quantity → allocate processes → Costing.
3. Costing: review cost, accept missing details → finalise → order is created with job stages.
4. Units work through the stages → Dispatch → Invoice download → Payment received in Income & Expenses.
5. Loan taken → spend from it (Paid from) → EMIs (Pays back) → Debts tab shows what is still owed.

## Success metrics
- The customer runs daily work on Vertex without paper costing sheets (assumed - confirm).
- No support calls about lost data or lost drafts.
- Products with "missing details" fall to zero over time as the customer fills them in.

## Open questions
- Should the customer's usual product sizes and material suppliers be bulk-filled from their files?
- Will more than one PC on the LAN use the same server? (The server mode supports it; not deployed that way yet.)
- What GST/e-invoice reporting does their accountant need beyond the current GST report?
