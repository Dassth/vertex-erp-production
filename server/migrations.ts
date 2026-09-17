/* ---------------------------------------------------------------------------
 * Versioned database migrations. Applied in order, once each, and recorded in
 * vertex_schema_migrations. Never edit a released migration — add a new one.
 * Backups include these files so a destination database can be prepared with
 * exactly the schema the data was exported from.
 * ------------------------------------------------------------------------- */

export interface Migration {
  version: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
create table if not exists vertex_state (
  id smallint primary key check (id = 1),
  revision bigint not null,
  data jsonb not null,
  updated_at timestamptz not null,
  updated_by text not null
);
create table if not exists vertex_history (
  revision bigint primary key,
  command text not null,
  actor text not null,
  at timestamptz not null default now(),
  data jsonb not null
);
create table if not exists vertex_sessions (
  token_hash text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists vertex_drafts (
  user_id text not null,
  draft_key text not null,
  rev bigint not null,
  data text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_key)
);
create table if not exists vertex_meta (
  key text primary key,
  value text not null
);
`,
  },
  {
    version: 2,
    name: 'backend_only_access',
    // Only the Node backend (a role that bypasses RLS, e.g. Supabase "postgres") may read these tables.
    // RLS without policies denies the Supabase Data API roles even if grants are added later.
    sql: `
alter table vertex_state enable row level security;
alter table vertex_history enable row level security;
alter table vertex_sessions enable row level security;
alter table vertex_drafts enable row level security;
alter table vertex_meta enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on vertex_state, vertex_history, vertex_sessions, vertex_drafts, vertex_meta from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on vertex_state, vertex_history, vertex_sessions, vertex_drafts, vertex_meta from authenticated';
  end if;
end $$;
`,
  },
  {
    version: 3,
    name: 'pbkdf2_function',
    // PBKDF2-HMAC-SHA-256 (32-byte key) inside PostgreSQL, byte-identical to node:crypto and Web Crypto.
    // Used by deployments whose runtime cannot run 120,000 iterations itself (Cloudflare Workers).
    // Needs pgcrypto; where it is unavailable the function is simply not created.
    sql: `
do $mig$
begin
  if exists (select 1 from pg_available_extensions where name = 'pgcrypto') then
    create extension if not exists pgcrypto;
    execute $fn$
      create or replace function vertex_pbkdf2_sha256(pw text, salt_hex text, iters integer)
      returns text
      language plpgsql
      immutable strict
      set search_path = pg_catalog, public, extensions
      as $body$
      declare
        k bytea := convert_to(pw, 'UTF8');
        u bytea;
        a bigint; b bigint; c bigint; d bigint;
      begin
        if iters < 1 or iters > 1000000 then raise exception 'invalid iteration count'; end if;
        u := hmac(decode(salt_hex, 'hex') || decode('00000001', 'hex'), k, 'sha256');
        a := ('x' || encode(substring(u from 1 for 8), 'hex'))::bit(64)::bigint;
        b := ('x' || encode(substring(u from 9 for 8), 'hex'))::bit(64)::bigint;
        c := ('x' || encode(substring(u from 17 for 8), 'hex'))::bit(64)::bigint;
        d := ('x' || encode(substring(u from 25 for 8), 'hex'))::bit(64)::bigint;
        for i in 2..iters loop
          u := hmac(u, k, 'sha256');
          a := a # ('x' || encode(substring(u from 1 for 8), 'hex'))::bit(64)::bigint;
          b := b # ('x' || encode(substring(u from 9 for 8), 'hex'))::bit(64)::bigint;
          c := c # ('x' || encode(substring(u from 17 for 8), 'hex'))::bit(64)::bigint;
          d := d # ('x' || encode(substring(u from 25 for 8), 'hex'))::bit(64)::bigint;
        end loop;
        return lpad(to_hex(a), 16, '0') || lpad(to_hex(b), 16, '0') || lpad(to_hex(c), 16, '0') || lpad(to_hex(d), 16, '0');
      end
      $body$
    $fn$;
    -- Only the backend may call it (never the Supabase Data API roles).
    execute 'revoke all on function vertex_pbkdf2_sha256(text, text, integer) from public';
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute 'revoke all on function vertex_pbkdf2_sha256(text, text, integer) from anon';
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function vertex_pbkdf2_sha256(text, text, integer) from authenticated';
    end if;
  end if;
end
$mig$;
`,
  },
  {
    version: 4,
    name: 'migrations_table_backend_only',
    sql: `
alter table vertex_schema_migrations enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on vertex_schema_migrations from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on vertex_schema_migrations from authenticated';
  end if;
end $$;
`,
  },
]

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

export const MIGRATIONS_TABLE = `
create table if not exists vertex_schema_migrations (
  version integer primary key,
  name text not null,
  applied_at timestamptz not null default now()
)`

/** Statements of one migration (split on semicolons outside dollar-quoted blocks, e.g. $$ or $tag$). */
export function statements(sql: string): string[] {
  const out: string[] = []
  let buf = ''
  let quote: string | null = null
  for (let i = 0; i < sql.length; i++) {
    const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))?.[0]
    if (tag && (quote === null || quote === tag)) {
      quote = quote === null ? tag : null
      buf += tag
      i += tag.length - 1
      continue
    }
    if (sql[i] === ';' && quote === null) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }
    buf += sql[i]
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

export function migrationFileName(m: Migration): string {
  return `${String(m.version).padStart(4, '0')}_${m.name}.sql`
}
