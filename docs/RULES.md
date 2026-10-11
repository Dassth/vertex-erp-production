# Rules

UI rules from `AGENTS.md` (repo root) apply in full; this file adds project rules.

## Code style
- TypeScript strict; types live in `src/lib/types.ts`. New DB fields are **optional** (`field?:`) so old data still loads.
- React function components; page files `XxxPage.tsx`, editors `XxxEditor.tsx`, drawers `XxxDrawer.tsx`.
- Use the existing UI kit (`components/ui.tsx`, `components/page.tsx`) and `vx-*` classes; don't hand-roll buttons, fields or modals.
- Money is stored in paise/rupees exactly as the existing helpers expect; format with `moneyPaise`, `fmtDate` and `Intl` helpers in `lib/format.ts`.
- Plain-English labels a non-technical factory owner understands ("Rate not entered", not "rate undefined").
- Use the `…` character, not `...`.

## Patterns to follow
- Every write goes through a domain command: `command('name', (args) => (db, ctx) => ok(db, value) | fail(msg, { issues }))`, with `audit()`, registered via `src/domain/registry.ts`.
- Pure calculations live in `src/lib` (costing, yield, sizeScale, schedule) and are unit-tested.
- Costing always uses `planCostingSource(db, plan, product)` so size scaling applies everywhere, including the finalise snapshot.
- New collections are added to `buildEmptyDB` so `normalizeDB` upgrades old databases.
- Forms: validate after typing, errors inline, focus the first invalid field (`focusFirstInvalid`), keep the submit button enabled until saving starts.
- Long forms use `useFormDraft` / `useNewDraftId` so drafts survive leaving the page.
- Missing details are **warnings** (`gap: true`), never blockers, unless the value is actually wrong.
- URL holds filters, tabs and pages (`?tab=…&filter=…`).

## Never do
- Never hardcode secrets; use env vars. Never commit or quote the licence secrets file.
- Never delete, overwrite or reset customer data in a change, migration, import or update. Imports fill blanks only.
- Never delete or rewrite working code unrelated to the task.
- Never add a dependency without stating why.
- Never change the cloud demo DB / Worker (Supabase, Cloudflare) unless the owner asks.
- Never run system-changing installers or commands on the dev machine; test on a test copy (port 8790, scratchpad data).
- Never use `transition: all`, `outline: none` without a focus ring, or `<div onClick>` for navigation.

## Error handling & logging
- Commands return `fail(message, { issues })`; the UI shows a toast or inline issues, never a crash.
- The server reports DB failures as "not saved"; nothing silently falls back to local storage.
- `RouteBoundary` catches page errors and offers a way back.
- Installer: `Invoke-Program` judges native tools by exit code; logs go to `C:\ProgramData\VertexERP\logs`.

## Testing
- `npx vitest run --maxWorkers=2` (the dev PC is low on RAM).
- Add or extend tests next to the code (`*.test.ts`, `*.test.tsx`); domain flows go in `src/domain/workflow.test.ts`.
- Known pre-existing failures: 2 in invoices UI tests and 1 in login; don't add new ones.
- Verify UI changes in the test server (`.claude/launch.json` → "vertex-server-test") before shipping.

## Git / commits
- Work on `main`; push to origin main when the work is done (the owner expects it).
- Short commit titles in plain English describing the user-visible change.
- Don't commit `release/`, `.env`, the scratchpad, or the untracked `brag-output/` folder.

## Security
- Passwords: PBKDF2-SHA-256, 120,000 iterations (`server/passwords.ts`).
- Permissions are checked on the server for every command (`lib/permissions.ts`); browser mode is not a security boundary.
- Licence responses are Ed25519-signed and verified on the client side.
- Only test passwords are typed into localhost test copies.
