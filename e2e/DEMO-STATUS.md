# Customer demo — status and open checks (2026-09-16)

## Demo dataset (fictional)
Stored only in `e2e/.playwright-profile`, used with the dev server at http://localhost:5180.
Open it with `npm run demo:open`. Do not run Playwright while that window is open.

Confirmed by a read-only check on 2026-09-16:
- Company: Vertex Print Pack (TEST). Customer: Apex Industries. Product: Acceptance Test Box (one stage, three processes).
- JOB-0001: 1,000 pieces, Completed. Plate preparation (U1), Offset printing (U2, machine Heidelberg SM 52) and Print inspection (U1) each have a responsible person.
- Dispatches: DSP-0001 (100) and DSP-0002 (200); 700 remaining.
- Invoices: INV/2026-27/0001 (2,237.28) and INV/2026-27/0002 (4,474.56).
- JOB-0002: 500 pieces, Active. Plate preparation is In Progress; the other two processes are Scheduled.
- Admin tiers: Administrator 1 = full, Administrator 2 = operations, Administrator 3 = billing. Passwords are set for all three admins and for Unit 1 and Unit 2.
- Leftover record: a person "Suresh M" also exists on Unit 1, created by mistake in an earlier setup attempt. It was left in place.
- Backups: the profile holds only `vertex-erp-db-v2` (no `-unreadable-*` backup key). The app has no export feature, so no business-data backup file was made.

## Demo status vs production readiness
The customer demo is ready. The application is **not** ready for production:
- All data lives in one browser's localStorage. There is no server, no sharing between devices or users, and no server-side backup.
- Permissions are enforced in the browser only, not by a server.

## Not yet verified (do later; do not report these as passed)
- Migration of old stage-level records through the UI (covered by unit tests only).
- Several tabs editing the same data at once, run in a real browser.
- How Tamil text looks in the generated PDFs (only the PDF header and file size were checked).
- Keyboard navigation and focus.
- A full acceptance run on a fresh profile. The last run (14 passed, 12 skipped) reused this dataset, so the setup, execution and dispatch steps were skipped there. They had passed earlier in smaller runs on the same data.
- The Browser pane's copy of the 5180 app was found empty (database created 2026-09-16 08:37:21Z). The cause has not been established.

## Next end-to-end run
Use a NEW isolated profile directory. Do not delete or change `e2e/.playwright-profile`.
`e2e/acceptance.spec.ts` currently hard-codes that profile path, so the new run needs a path override first. This is not done yet.
