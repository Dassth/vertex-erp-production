# Architecture

## Tech stack
| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + Vite + TypeScript, React Router 7 | Fast dev loop, typed domain |
| Styling | Tailwind CSS 4 + `vx-*` component classes and tokens in `src/index.css` | One design system, no CSS sprawl |
| Icons | lucide-react | Consistent stroke icons |
| Domain logic | Pure commands in `src/domain` (`(db, ctx) => OpResult`) | Same rules run in the browser and on the server |
| Server | Node HTTP (`server/http.ts`, `server/api.ts` fetch handler) | Also runs as a Cloudflare Worker (`server/worker.ts`) |
| Database | PostgreSQL 17 (installed by setup); PGlite for dev/tests | Real DB offline; embedded engine for tests |
| Documents | pdfmake (PDF out), pdfjs-dist (PDF in), own xlsx reader/writer, adm-zip (backups) | Offline file import/export |
| Licence | Cloudflare Worker `licence/worker.ts`, Ed25519-signed responses | Suspend/allow remotely, verify offline |
| Installer | `installer/build.mjs` → IExpress EXE running `installer/setup.ps1` (PowerShell 5.1) | No extra tools on the customer PC |
| Tests | Vitest + Testing Library + jsdom; Playwright (e2e) | |
| Lint | oxlint | |

## Folder structure
```
src/
  App.tsx            routes
  components/        shared UI (ui.tsx, page.tsx, AppShell, LicenceGate, DocumentPreview, SizeInput, Picker, SupplierInput, CustomerInput, GstRateSelect, Unfinished)
  domain/            commands: master, suppliers, planning, orderCosting, production, dispatch, purchases, cashbook, imports, resources, system; registry.ts imports all
  features/          pages: master/{products,costing(=Materials),suppliers,customers}, planning, costing, production, units, unit, dispatch, billing, invoices, accounts, reports, settings, home, customers
  lib/               pure helpers: types.ts, costing, yield, sizeScale, schedule, billing, gst, cashbook, fileTable, productSheet, drafts, unfinished, format, permissions, migrate
  store/             store.tsx (browser), serverStore.tsx + remote.ts (server mode), coordinator
  pages/LoginPage.tsx
server/              api.ts, service.ts, storage.ts (pg), storage-pglite.ts, migrations.ts, backup.ts, backup-fs.ts, licence.ts, passwords.ts, desktop.ts, demo.ts, main.ts (CLI)
licence/             worker.ts + wrangler.jsonc (licence admin & check)
installer/           build.mjs, setup.ps1, uninstall.ps1
e2e/                 Playwright acceptance spec
docs/                these docs + offline-install.md, server-storage.md, customer-onboarding/
```

## Data model
One `VertexDB` document (stored in PostgreSQL by the server); `normalizeDB` fills any new collection with an empty list so old data upgrades safely.
- `company`, `settings`, `counters` (code numbers like DBT-0001, SUP-0001), `migrations`, `version`, `revision`
- `units` → `people`, `machines` (each has `unitId`)
- `users` (role `admin` with tier `full | operations | billing`, or `unit`)
- `materials` (form sheet/roll/ready-made/other, price, `supplier` name)
- `suppliers` (name, contact person, phone, email…)
- `products` (`baseSize?`, `materials[]` with `wastagePct?`, `stages[] → processes[]` with time, rate, per-process materials)
- `customers` (`unregistered?` = URD)
- `plans` (customer, product, quantity, `size?`, `processUnits`, `processPeople?`, `processMachines?`)
- `costings` (snapshot frozen on finalise, `missingAtFinalize?`, `revisions?`)
- `orders` (job stages built from plan allocation) → `dispatches` → `invoices`
- `purchases` (purchase bills)
- `cashbook` (money entries; `paidFromDebtId?`, `repaysDebtId?`)
- `debts` (lender, date, amount, purpose, mode)
- `notifications`, `audit` (every command writes an audit entry)
- Drafts live outside the DB in `vertex_drafts` (server) / localStorage (browser), key `vertex-erp-draft-v1:{userId}:{scope}:new:{id}`.

## API / routes
| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | /api/auth/login, /logout, /first-password, /change-password | Sign-in and passwords | public / session |
| GET | /api/session, /api/state | Current user; full DB state | session |
| POST | /api/commands | Run a named domain command `{name, args}` | session + permission check |
| GET/PUT/DELETE | /api/drafts (`?prefix=` to list) | Unfinished forms | session |
| GET | /api/licence, POST /api/licence/check | Licence state (refreshed if stale) | session |
| GET/POST | /api/backup/status, /run, /validate, /restore, /fresh, /api/backup/{name} | Backups and restore | full admin |
| GET | /api/export, /api/accounts | Data export; accounts list | admin |
| POST | /api/replica/backup | Second-copy backup | server |
| GET | /api/health | Health check | public |

UI routes: `/login`, `/home`, `/master/{products,products/:productId,costing,suppliers,customers}`, `/planning`, `/planning/:planId`, `/costing`, `/costing/:planId`, `/production`, `/units`, `/units/:unitId`, `/dispatch`, `/billing`, `/invoices`, `/accounts`, `/reports`, `/settings`, `/customers`, `/admin1`, `/admin2`.

## External services & env vars
- Licence Worker (Cloudflare): secrets `ADMIN_KEY`, `LICENCE_SIGNING_KEY` (never in the repo).
- Server: `DATABASE_URL` (cloud mode), `BACKUP_DIR`, `VERTEX_HOME`, `VERTEX_PG_BIN`.
- Build: `VERTEX_STAGE_APP` (installer staging folder), `DEMO_BACKUP_OUT` (demo backup output).
- Optional cloud demo: Cloudflare Worker + Supabase (see `docs/server-storage.md`); do not change it without the owner's say-so.

## Data flow
1. A UI action calls `run(command(args))`.
2. Browser mode: the command runs on the in-memory DB, which is saved to localStorage.
3. Server mode: POST `/api/commands` → the server re-reads the user inside a transaction, re-runs the same command and permission checks, COMMITs, then replies. A failure means "not saved"; there is no silent fallback.
4. The client refreshes state; `LicenceGate` polls `/api/licence` every 10 s and on focus.

## Deployment
- Customer PC (Windows, offline): `npm run build:windows` → `release/VertexERP-Setup-{LICENCE}-v{VERSION}.exe`.
  - Program: `C:\Program Files\VertexERP`.
  - Database: `C:\ProgramData\VertexERP\db` (runs as NETWORK SERVICE).
  - Hourly backups: `C:\ProgramData\VertexERP\backups`.
  - Second copy: `C:\VertexERP-Backups`.
- An update backs up first (scheduled task as NETWORK SERVICE), then replaces only the program files; data is kept.
- Build tip: on a full E: drive use `node installer/build.mjs --work C:\...`.
- Details: `docs/offline-install.md`, `docs/server-storage.md`.
