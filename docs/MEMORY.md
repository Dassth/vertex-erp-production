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

