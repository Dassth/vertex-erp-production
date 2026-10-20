# Memory
Append-only log. Newest at the bottom.

## 2026-09-17 - Two storage modes
- **Context:** The app had to run in a browser demo and on a real server.
- **Decision / finding:** The same domain commands run in both; in server mode the server re-runs every command inside a transaction and replies only after COMMIT.
- **Why:** One set of business rules; permissions enforced server-side.
- **Impact:** `src/domain/*`, `server/api.ts`, `server/service.ts`, `docs/server-storage.md`

## 2026-10-11 - PowerShell 5.1 treats native stderr as an error
- **Context:** An update failed with "pg_ctl: PID file … does not exist".
- **Decision / finding:** Native tools run through `Invoke-Program` (relaxed error preference, judged by exit code); stop the DB only when `postmaster.pid` exists.
- **Why:** Under `$ErrorActionPreference = 'Stop'`, PS 5.1 turns any native stderr line into a terminating error.
- **Impact:** `installer/setup.ps1`

## 2026-10-11 - Pre-update backup must run as NETWORK SERVICE
- **Context:** "Your data could not be backed up" during an update.
- **Decision / finding:** Backup/restore run through a temporary scheduled task as NETWORK SERVICE (`Invoke-AsServer`), with output logged to `logs\setup-{name}.txt`.
- **Why:** pg_ctl drops admin rights with a restricted token and cannot write files owned by NETWORK SERVICE.
- **Impact:** `installer/setup.ps1`

## 2026-10-11 - Licence state must be refreshed while logged in
- **Context:** The suspend popup only appeared at login.
- **Decision / finding:** `/api/licence` refreshes if stale (10 s); `LicenceGate` polls every 10 s and on focus/visibility change.
- **Why:** The endpoint was returning a cached state.
- **Impact:** `server/api.ts`, `src/components/LicenceGate.tsx`

## 2026-10-11 - Missing details never block work
- **Context:** Customer product files have gaps; validation stopped saving and costing.
- **Decision / finding:** Missing values become `gap: true` warnings (amber). Finalising accepts them with a tick (`acceptMissing`) and records `missingAtFinalize`. Wrong values are still refused.
- **Why:** The owner asked that missing data must not stop the flow; small hints show where to fill.
- **Impact:** `src/lib/costing.ts`, `src/domain/orderCosting.ts`, `src/domain/master.ts`, `OrderCostingPage.tsx`

## 2026-10-11 - Imports fill blanks only
- **Context:** Importing 80 products from Excel/CSV/PDF.
- **Decision / finding:** `importProductsFromFile` creates new products or fills blanks on existing ones; it never overwrites.
- **Why:** Existing customer data must never be lost.
- **Impact:** `src/domain/imports.ts`, `src/lib/fileTable.ts`, `src/lib/productSheet.ts`

## 2026-10-11 - Drafts live on the server and resume
- **Context:** Drafts were lost or caused "already exists".
- **Decision / finding:** Drafts are stored in `vertex_drafts` (plus localStorage); `useNewDraftId` resumes the latest draft (`?fresh=1` starts a new one); leaving keeps the draft, with no discard prompt.
- **Why:** The owner wants to come back to the same step.
- **Impact:** `src/lib/unfinished.ts`, `src/lib/useFormDraft.ts`, `src/components/Unfinished.tsx`, `server/service.ts`

## 2026-10-11 - One time and one rate per process
- **Context:** Voice note: the customer never filled run hours or setup charge, and those fields confused them.
- **Decision / finding:** A process has one Time (hours) and one Rate (per piece default, or per hour on total hours). The old run-hours/setup fields are hidden but still counted, so old data keeps its cost.
- **Why:** Simpler entry; old data was test data only, but nothing is deleted.
- **Impact:** `ProductEditor.tsx`, `src/lib/costing.ts`

## 2026-10-11 - Size scaling from the product's usual size
- **Context:** The same product is made in different sizes.
- **Decision / finding:** `product.baseSize` vs `plan.size` gives L/B factors. Sheet cuts scale by L/B; roll/bulk scale by their average; ready-made stays as is; the ups override is cleared. Always go through `planCostingSource`.
- **Why:** Proportional scaling was approved by the owner (50×50 → 100×100).
- **Impact:** `src/lib/sizeScale.ts`, `src/domain/orderCosting.ts`, `src/domain/planning.ts`, `PlanEditor.tsx`

## 2026-10-11 - Loans are not income
- **Context:** The owner wanted debts tracked with a date and a source.
- **Decision / finding:** Separate `debts` collection. Money out can be "Paid from" a loan (excluded from the cash balance), and EMIs "Pay back" a loan. A loan can't be deleted while it is linked.
- **Why:** Borrowed money must not inflate income.
- **Impact:** `src/domain/cashbook.ts`, `src/lib/cashbook.ts`, `src/features/accounts/*`

## 2026-10-11 - Features must be visible where the user looks
- **Context:** The owner couldn't find Debts or the supplier field.
- **Decision / finding:** Add a header button ("Loan taken…") and a popup choice, put "Bought from" first in the material drawer, and add a "No supplier" tile/filter.
- **Why:** A feature hidden in a tab doesn't exist for this user.
- **Impact:** `AccountsPage.tsx`, `MaterialDrawer.tsx`, `MasterCostingPage.tsx`

## 2026-10-11 - Build environment notes
- **Context:** The E: drive is nearly full and the dev PC is low on RAM.
- **Decision / finding:** `node installer/build.mjs --work <dir on C:>` stages the ~300 MB build elsewhere; IExpress is retried once. Run tests with `--maxWorkers=2`.
- **Why:** IExpress failed with a full disk; Vitest ran out of memory.
- **Impact:** `installer/build.mjs`, `vite.desktop.config.ts`

## 2026-10-12 - One picker for every master record
- **Context:** The owner found supplier boxes (plain datalist), customer/product selects and the material search all behaving differently; the material list sat inside the form and mixed with the fields below.
- **Decision / finding:** `components/Picker.tsx` is the only chooser: list on focus/click, type to filter, “+ New …” button beside it. The list is portalled to `<body>` with fixed position (flips up near the bottom), so tables with `overflow-x-auto` and scrolling dialogs can't clip it. Free-text mode (`onText`) keeps names not in the list (suppliers, “Paid to”).
- **Why:** One behaviour everywhere so a non-technical user isn't confused.
- **Impact:** `Picker.tsx`, `SupplierInput.tsx`, `CustomerInput.tsx`, `AddMaterialDialog.tsx`, `ProductEditor.tsx`, `PurchaseBills.tsx`, `PlanEditor.tsx`, `AccountsPage.tsx`, `MaterialDrawer.tsx`
- **Gotcha:** after a “New …” dialog closes, focus returns to the box; the list must not pop open then (React StrictMode runs overlay effects twice in dev, so a one-shot flag is not enough — it is cleared only by a click or typing).

## 2026-10-12 - Month-end entries in one press
- **Context:** The owner wants each month's sales and purchases in Income & Expenses as separate lines (for printing and the government reports) without typing each one.
- **Decision / finding:** `recordMonthDocuments({ month, mode, sales, purchases })` turns every invoice / purchase bill of that month with money still due into its own receipt / payment (amount = what is still due, date = document date, note “Added at month end for …”). One confirmation dialog lists them first; one payment mode for all, editable later.
- **Why:** The details already exist on the documents; only what is still due is added, so pressing again never doubles anything.
- **Impact:** `src/lib/cashbook.ts` (`monthDocsToRecord`), `src/domain/cashbook.ts`, `src/features/accounts/MonthEndDialog.tsx`, `AccountsPage.tsx`

## 2026-10-12 - Outside units (job work)
- **Context:** Some processes are given to other firms; units were fixed at U1–U4 with no way to add one.
- **Decision / finding:** `addUnit` creates `U5`, `U6`… (never reused). `ProductionUnit.outside` marks job work; `contactPerson`, `phone`, `address` are optional on every unit. Outside units need no people/machines in Planning; Units shows an “Outside” badge and their contact.
- **Why:** Planning must record who does every process, including work done outside.
- **Impact:** `src/lib/types.ts`, `src/domain/resources.ts`, `src/features/units/UnitDialog.tsx`, `UnitsMonitorPage.tsx`, `SettingsPage.tsx`, `PlanEditor.tsx`

## 2026-10-12 - "Cut piece does not fit" usually means a unit mix-up
- **Context:** The owner saw “TNPL Auro Graphic Board 280gsm 31.5x41.5: the cut piece does not fit…” with a link running off the panel.
- **Decision / finding:** The message now shows the cut size and sheet size in the material's unit and asks whether a very small sheet (<120 mm) was typed in inches with the unit set to mm. Fix links wrap. Label “Configure X” → “Open X in Materials”.
- **Why:** A 31.5 × 41.5 sheet is inches; saved as mm, no box piece can fit.
- **Impact:** `src/lib/costing.ts`, `src/components/page.tsx` (`IssueList`)

## 2026-10-12 - Material prices per order
- **Context:** Material prices move between setting up Master and planning an order.
- **Decision / finding:** `Plan.materialPrices` (material id → price) overrides Master for that plan only. All plan costing reads materials through `planMaterials(db, plan)` (preview, readiness, costing page, finalize + snapshot). “Save to Master too” calls `setMaterialPrice` and clears the order's own price.
- **Why:** The owner wants to correct a changed price at planning time without editing Master for every case.
- **Impact:** `src/lib/types.ts`, `src/domain/orderCosting.ts`, `src/domain/planning.ts`, `src/domain/master.ts`, `PlanEditor.tsx` (`MaterialPricesCard`), `OrderCostingPage.tsx`
- **Gotcha:** building the EXE writes into `release/`, which the Vite dev server watches — it crashed with EBUSY. Stop the preview before `installer/build.mjs`.

## 2026-10-12 - Rates editable on the costing screen
- **Context:** The owner couldn't change a material or process rate on a costing, even on a released order being revised.
- **Decision / finding:** `CostingInputs.materialPrices` / `processRates` hold this order's own rates; `computeOrderCosting` applies them (a process shows “This order” as its rate source). They travel with the inputs, so draft costing, finalize (also baked into the snapshot materials) and `reviseCosting` all use them. The Rate column sits next to the name and shows the rate in use; typing the usual rate or clearing goes back to it.
- **Why:** Prices change after Master and planning; the costing screen is where the owner checks the price.
- **Impact:** `src/lib/types.ts`, `src/lib/costing.ts`, `src/domain/orderCosting.ts`, `OrderCostingPage.tsx`

## 2026-10-12 - Edge allowance dropped
- **Context:** The owner asked to remove edge allowance completely.
- **Decision / finding:** `calculateYield` / `validateUpsOverride` use the whole sheet; `edgeMarginMm` is optional on `YieldInput` and ignored. New materials store 0; stored values stay in the data but are not counted. Fields removed from Add material and the material drawer.
- **Why:** Not how the customer's shop works; it lowered pieces per sheet.
- **Impact:** `src/lib/yield.ts`, `src/domain/master.ts`, `MaterialDrawer.tsx`, `AddMaterialDialog.tsx`, `MasterCostingPage.tsx`, `src/lib/costing.ts`
- **Note:** pieces per sheet can go up for existing products; finalized costings keep their snapshot.

## 2026-10-12 - Cutting gap dropped as well
- **Context:** Right after the edge allowance, the owner asked to remove the cutting gap.
- **Decision / finding:** `calculateYield` places pieces edge to edge; `cutGapMm` is optional and ignored. Fields removed. Test fixtures now give 20 pieces a sheet (was 18) and the costing test totals were re-worked by hand.
- **Impact:** `src/lib/yield.ts`, `src/domain/master.ts`, material forms, `src/lib/costing.test.ts`, `src/lib/yield.test.ts`

## 2026-10-12 - Quotations before planning
- **Context:** The owner wanted to give a price without planning or production.
- **Decision / finding:** New `quotations` collection (optional on `VertexDB`, counter `quotation`, `QTN-0001`). Price = `computeOrderCosting` on Master (`quoteCosting`), optional hand-typed `pricePerPiece` (`quoteTotals`). `quotationToPlan` makes a Draft plan (`Plan.quotationId`, customerRef = quotation code); `openCosting` starts from the quotation's inputs, turning a hand price into the matching markup. PDF prints no cost or profit. Route `/quotations` needs `costing`.
- **Impact:** `src/domain/quotations.ts`, `src/features/quotations/QuotationsPage.tsx`, `src/lib/pdfDocs.ts` (`quotationDefinition`), `DocumentPreview.tsx` (`quotationDoc`), `orderCosting.ts`, `App.tsx`, `AppShell.tsx`, `permissions.ts`, `quickAccess.ts`

## 2026-10-12 - Tap a row to open it, everywhere
- **Context:** The owner couldn't find how to edit a supplier — only a small pencil did it.
- **Decision / finding:** `openRow(open)` (components/page.tsx) makes the whole table row open its record; links/buttons/fields inside keep their own action. Every such row also keeps a visible “Edit” text button (keyboard + clarity); icon-only pencils were replaced.
- **Why:** “If it looks clickable, it must be clickable” (AGENTS.md) and one pattern everywhere.
- **Impact:** Suppliers, Accounts entries, Debts, Purchase bills, Products, Materials, Planning, Costing list, Quotations, Units cards

## 2026-10-14 - New product/plan opens blank; drafts resume from their card (replaces part of 2026-10-11 "Drafts live on the server and resume")
- **Context:** At the customer, “Add manually” kept showing a Sweet Box product that was already saved and complete.
- **Decision / finding:** Two causes. (1) “Add manually” / “New plan” resumed the latest unfinished draft by design — now they link with `?fresh=1`; unfinished work is resumed only from the “Unfinished …” card. (2) Server-mode race in `ProductEditor`: the pre-save autosave `putDraft` could reach the server after the post-save `deleteDraft`, re-creating the draft. Server draft writes now go through one ordered queue, and saving/discarding closes the copy so waiting autosaves are dropped (plans' `useFormDraft` already had a generation guard).
- **Why:** A finished product must never come back as unfinished; a “new” button must start new.
- **Impact:** `ProductEditor.tsx`, `ProductsPage.tsx`, `PlanningPage.tsx`, `MasterCostingPage.tsx`
- **Note:** copies already left on a customer's server are not deleted automatically (never delete data); the card labels them “already saved as PRD-…” so the owner can Discard them.

## 2026-10-20 - GST is decided by states, never guessed
- **Context:** URD invoices in Tamil Nadu were saved with no split and reports showed them as IGST / "(GST NOT SPLIT)".
- **Decision / finding:** `lib/gst.ts` is the one helper: seller state = company GSTIN else `company.stateCode`; buyer state = GSTIN, else Place of supply (`lib/gstStates.stateCodeFrom` accepts names, short forms, codes), else a state named in the delivery address. CGST = round(tax/2), SGST = rest. Unknown state blocks invoicing. Place of supply is stored as a 2-digit code.
- **Impact:** `lib/gst.ts`, `lib/gstStates.ts`, `lib/billing.ts` (`splitTax`), `domain/dispatch.ts`, reports and PDFs, `components/StateSelect.tsx`

## 2026-10-20 - Data migrations: run once, logged, backed up first
- **Decision / finding:** `lib/dataMigrations.ts` holds record-changing migrations (marker in `db.migrations`, Activity-log entry per change). `normalizeDB` applies them on read; the server saves them once at start-up after a backup with the existing backup code (`server/serve.ts`, `VertexService.saveMigrations`). New databases start with the marker. A scheduled backup must not run in the same second as that backup (archive names are per second).
- **Impact:** `lib/dataMigrations.ts`, `lib/db.ts`, `lib/defaults.ts`, `server/serve.ts`, `server/service.ts`

## 2026-10-20 - Loans are cash, not income; EMI interest is the expense
- **Decision / finding:** Balance = brought forward + receipts + loans received − every payment (computed from `debts`, no extra entries). Summary income excludes loans; expenses exclude EMI principal (`repaymentParts`). `MoneyEntry.principal/interest`; missing = all principal. Replaces the 2026-10-11 rule that money spent from a loan stays out of the balance.
- **Impact:** `lib/cashbook.ts`, `domain/cashbook.ts`, `AccountsPage.tsx`, `DebtsCard.tsx`

## 2026-10-20 - Text fields are typing-safe; screens retry their download
- **Decision / finding:** `Input`/`Textarea` (via `components/typingSafe.ts`) and `NumberInput` never take an outside value while focused; on blur the typed text is sent again. Route chunks load with `lib/lazyRetry.ts` (retry, then one guarded reload); the server 404s missing `/assets/*` instead of returning index.html; the server-mode app waits for `ready` before routing.
- **Impact:** `components/ui.tsx`, `components/page.tsx`, `App.tsx`, `RouteBoundary.tsx`, `server/http.ts`
- **Gotcha:** this PC often has little free memory; run `tsc` with `NODE_OPTIONS=--max-old-space-size=2048` and stop preview servers before PGlite-heavy steps.

