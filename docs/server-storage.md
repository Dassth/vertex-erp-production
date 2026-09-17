# Vertex ERP — deployment, storage, backups and migration

## Current deployment (2026-09-17)

| Part | Where |
|---|---|
| App + API | Cloudflare Worker **vertex-erp** — https://vertex-erp.suryadass010405.workers.dev (account "Suryadass010405@gmail.com's Account") |
| Database | Supabase project **vertex-erp**, ref `emdoapjzkklmxhizeorc`, region ap-south-1, PostgreSQL 17 |
| Connection | Supabase transaction pooler (`DATABASE_URL`) — Worker secret; local `.env` for the Node tools (never committed) |
| Schema | `public`, migrations 1–4 (`server/migrations.ts`) |
| Stored backups | Node server: `BACKUP_DIR` on the machine running it. Cloudflare: **pending** — R2 is not enabled on the account |

Only the backend reads the tables: RLS is enabled with no policies and the Supabase Data API roles (`anon`, `authenticated`) have no grants. The backend connects as `postgres`, which bypasses RLS.

## Two storage modes

| Mode | Build | Data | Permissions enforced by |
|---|---|---|---|
| Browser (default) | `npm run build` | This browser's localStorage | The browser (not a security boundary) |
| Server | `npm run build:server-app` | PostgreSQL via the Vertex API | The server |

In server mode each change is sent as a named domain command. The server re-reads the signed-in account inside a transaction, re-runs the business rules and permission checks, and replies only after COMMIT. A database failure is reported as "not saved" — the app never falls back to browser storage.

## Code map

- `server/api.ts` — HTTP API as a fetch handler (shared by Node and the Worker)
- `server/service.ts` — sign-in, sessions, commands, drafts, browser-dataset import
- `server/passwords.ts` — PBKDF2-SHA-256 (120,000 iterations): `node:crypto` on Node; inside PostgreSQL (`vertex_pbkdf2_sha256`, migration 3) on Cloudflare, whose runtime refuses more than 100,000 iterations. Hashes are identical either way.
- `server/storage.ts` — PostgreSQL access, schema option, versioned migrations; `server/storage-pglite.ts` — embedded engine for development and tests
- `server/backup.ts` — portable archives, validation, restore; `server/backup-fs.ts` — directory store; R2 store in `server/worker.ts`
- `server/worker.ts` + `wrangler.jsonc` — Cloudflare deployment; `server/main.ts` — Node server and maintenance commands

## Configuration boundary

All connection settings are environment variables (see `server/main.ts` header and `config.template.env` inside every backup): `DATABASE_URL`, `DATABASE_SCHEMA`, `PORT`, `BACKUP_DIR`, `BACKUP_INTERVAL_MIN`, `BACKUP_KEEP`, `VERTEX_BACKUP_PASSPHRASE`, `SECURE_COOKIES`, `ALLOWED_ORIGINS`. Cloudflare: `npx wrangler secret put DATABASE_URL` (and `VERTEX_BACKUP_PASSPHRASE`); the value must not include surrounding quotes.

## Deploy / update

```bash
npm run build:server-app      # server-mode client → dist-app-server
npm run build:server          # Node bundle → dist-server (maintenance commands)
node dist-server/main.js migrate
npx wrangler deploy
```

## Backups

Archive `vertex-erp-backup-YYYY-MM-DD-HHmmssZ.zip`: `manifest.json` (versions, export time, revision, counts, SHA-256 per file), `data.json` (all records and drafts, no credentials), `credentials.enc.json` (password hashes, AES-256-GCM, only when `VERTEX_BACKUP_PASSPHRASE` is set), `migrations/`, `config.template.env`, `RESTORE.md`. The app stores no attachments.

- Settings → Backup & Restore (Administrator 1): download a fresh backup, last successful backup and health, stored archives, validate an uploaded archive with a restore preview.
- CLI: `node dist-server/main.js backup --dir <dir>`, `verify <zip>`.
- Supabase's own platform backups are separate: https://supabase.com/docs/guides/platform/backups

A backup contains data only up to its export time.

## Restore / move to another database

1. Export a fresh archive (Settings, or `backup`).
2. Create an empty destination database (new Supabase project or PostgreSQL 15+ with pgcrypto for Cloudflare hosting).
3. `node dist-server/main.js restore <zip> --into <DATABASE_URL> --dry-run` — validates, applies migrations, shows counts and blockers.
4. `node dist-server/main.js restore <zip> --into <DATABASE_URL> --confirm <schema>` (default schema `public`).
   - Passwords: set `VERTEX_BACKUP_PASSPHRASE` to the passphrase used for the archive; otherwise add `--without-credentials` and each account chooses a new password.
   - A populated destination is refused; `--replace` writes a pre-restore archive first.
5. Point `DATABASE_URL` (Worker secret / `.env`) at the destination, deploy, sign in and check the records.
6. Keep the old project until the new one is verified.

Accounts belong to the app (not Supabase Auth), so changing a Supabase account email does not affect them.

## Local development

`node --liftoff-only dist-server/main.js serve --dev --data .vertex-data` (PGlite needs `--liftoff-only` on Node 24). PGlite does not guarantee persistence if the process is killed; use it only for development.
