/* ---------------------------------------------------------------------------
 * Back Moon Devs licence service (Cloudflare Worker + D1).
 *
 *   POST /v1/check           an installed copy asks for its licence; the answer
 *                            is signed with LICENCE_SIGNING_KEY (Ed25519).
 *   GET  /admin              the Back Moon Devs control page.
 *   GET  /admin/api/licences list          } Authorization: Bearer ADMIN_KEY
 *   POST /admin/api/licences create/update }
 *
 * Secrets: LICENCE_SIGNING_KEY (PKCS#8 DER, base64), ADMIN_KEY.
 * D1 binding DB (strongly consistent, so a change on the control page is what
 * the very next check sees). Table `licences` is written only from the control
 * page; table `seen` records a copy's last call, so a call can never write back
 * an older status.
 *
 * Lifetime (permanent) licences: fully paid. The copy never needs the internet
 * again to keep working; Back Moon Devs can still suspend it, which reaches the
 * copy whenever it is next online.
 * ------------------------------------------------------------------------- */

export type LicenceStatus = 'active' | 'suspended' | 'deactivated'

export interface LicenceRecord {
  licenceId: string
  customer: string
  status: LicenceStatus
  /** Fully paid: works for life, with no offline limit. */
  permanent: boolean
  /** Shown to the customer while suspended or deactivated. */
  message: string
  /** How long a copy may stay offline on one answer (ignored for lifetime licences). */
  graceDays: number
  notes: string
  createdAt: string
  updatedAt: string
  lastSeen: string | null
  lastVersion: string
  lastInstallId: string
  checks: number
}

type Seen = Pick<LicenceRecord, 'lastSeen' | 'lastVersion' | 'lastInstallId' | 'checks'>
type Stored = Omit<LicenceRecord, keyof Seen>

/** Where licences live: D1 in production, memory in tests. */
export interface LicenceStore {
  get(id: string): Promise<Stored | null>
  put(rec: Stored): Promise<void>
  list(): Promise<Stored[]>
  getSeen(id: string): Promise<Seen | null>
  putSeen(id: string, seen: Seen): Promise<void>
}

interface D1 {
  prepare(sql: string): { bind(...v: unknown[]): D1Stmt } & D1Stmt
  exec(sql: string): Promise<unknown>
}
interface D1Stmt {
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface Env {
  DB: D1
  LICENCE_SIGNING_KEY: string
  ADMIN_KEY: string
}

let schemaReady = false
export function d1Store(db: D1): LicenceStore {
  const ready = async () => {
    if (schemaReady) return
    await db.exec('create table if not exists licences (id text primary key, data text not null); create table if not exists seen (id text primary key, data text not null);')
    schemaReady = true
  }
  const one = async <T>(table: string, id: string) => {
    await ready()
    const row = await db.prepare(`select data from ${table} where id = ?`).bind(id).first<{ data: string }>()
    return row ? (JSON.parse(row.data) as T) : null
  }
  const save = async (table: string, id: string, value: unknown) => {
    await ready()
    await db.prepare(`insert into ${table} (id, data) values (?, ?) on conflict (id) do update set data = excluded.data`).bind(id, JSON.stringify(value)).run()
  }
  return {
    get: (id) => one<Stored>('licences', id),
    put: (rec) => save('licences', rec.licenceId, rec),
    list: async () => {
      await ready()
      const { results } = await db.prepare('select data from licences order by id').all<{ data: string }>()
      return results.map((r) => JSON.parse(r.data) as Stored)
    },
    getSeen: (id) => one<Seen>('seen', id),
    putSeen: (id, seen) => save('seen', id, seen),
  }
}

const STATUSES: LicenceStatus[] = ['active', 'suspended', 'deactivated']
const ID = /^[A-Z0-9][A-Z0-9-]{2,39}$/
const DAY = 86_400_000
/** A lifetime answer stays valid for a century. */
const LIFETIME_DAYS = 36_500
/** Record a copy's call at most this often, to keep writes low. */
const SEEN_EVERY_MS = 10 * 60_000

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Sign what an installed copy relies on. The payload is base64url JSON; the signature covers those exact characters. */
export async function signAnswer(signingKeyB64: string, payload: Record<string, unknown>): Promise<{ payload: string; signature: string }> {
  const key = await crypto.subtle.importKey('pkcs8', fromB64(signingKeyB64), { name: 'Ed25519' }, false, ['sign'])
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(body)))
  return { payload: body, signature: b64url(sig) }
}

/** The answer for one licence at one moment. Unknown licences are answered too, so the copy can say so. */
export function answerFor(rec: Pick<LicenceRecord, 'status' | 'permanent' | 'message' | 'customer' | 'graceDays'> | null, licenceId: string, now: Date) {
  const permanent = !!rec?.permanent && rec.status === 'active'
  const days = permanent ? LIFETIME_DAYS : Math.min(Math.max(rec?.graceDays ?? 7, 1), 60)
  return {
    licenceId,
    status: rec?.status ?? 'unknown',
    permanent,
    message: rec?.message ?? '',
    customer: rec?.customer ?? '',
    issuedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + days * DAY).toISOString(),
  }
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

const EMPTY_SEEN: Seen = { lastSeen: null, lastVersion: '', lastInstallId: '', checks: 0 }

async function full(store: LicenceStore, rec: Stored): Promise<LicenceRecord> {
  return { ...rec, permanent: rec.permanent ?? false, ...EMPTY_SEEN, ...((await store.getSeen(rec.licenceId)) ?? {}) }
}

/** The service on any store (tests pass an in-memory one). */
export async function handle(req: Request, env: Omit<Env, 'DB'>, store: LicenceStore): Promise<Response> {
  const url = new URL(req.url)
  const now = new Date()

  if (url.pathname === '/v1/check' && req.method === 'POST') {
    let body: { licenceId?: unknown; installId?: unknown; version?: unknown } = {}
    try {
      body = await req.json()
    } catch {
      return json(400, { ok: false, error: 'Invalid request.' })
    }
    const id = String(body.licenceId ?? '').toUpperCase()
    if (!ID.test(id)) return json(400, { ok: false, error: 'Invalid licence id.' })
    const rec = await store.get(id)
    if (rec) {
      const before = (await store.getSeen(id)) ?? EMPTY_SEEN
      const version = String(body.version ?? '').slice(0, 60)
      const installId = String(body.installId ?? '').slice(0, 60)
      const stale = !before.lastSeen || now.getTime() - Date.parse(before.lastSeen) >= SEEN_EVERY_MS
      if (stale || version !== before.lastVersion || installId !== before.lastInstallId)
        await store.putSeen(id, { lastSeen: now.toISOString(), lastVersion: version, lastInstallId: installId, checks: before.checks + 1 })
    }
    return json(200, await signAnswer(env.LICENCE_SIGNING_KEY, answerFor(rec ? { ...rec, permanent: rec.permanent ?? false } : null, id, now)))
  }

  if (url.pathname === '/admin' && req.method === 'GET')
    return new Response(ADMIN_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" } })

  if (url.pathname === '/admin/api/licences') {
    const auth = req.headers.get('authorization') ?? ''
    if (!safeEqual(auth.replace(/^Bearer\s+/i, ''), env.ADMIN_KEY)) return json(401, { ok: false, error: 'Wrong admin key.' })
    if (req.method === 'GET') {
      const all = await Promise.all((await store.list()).map((r) => full(store, r)))
      return json(200, { ok: true, licences: all })
    }
    if (req.method === 'POST') {
      const b = (await req.json().catch(() => ({}))) as Partial<LicenceRecord>
      const id = String(b.licenceId ?? '').toUpperCase()
      if (!ID.test(id)) return json(400, { ok: false, error: 'Licence id: 3–40 capital letters, digits or dashes, e.g. VPP-2026-01.' })
      const current = await store.get(id)
      const status = (b.status ?? current?.status ?? 'active') as LicenceStatus
      if (!STATUSES.includes(status)) return json(400, { ok: false, error: 'Status must be active, suspended or deactivated.' })
      const rec: Stored = {
        licenceId: id,
        customer: String(b.customer ?? current?.customer ?? '').slice(0, 120),
        status,
        permanent: typeof b.permanent === 'boolean' ? b.permanent : (current?.permanent ?? false),
        message: String(b.message ?? current?.message ?? '').slice(0, 300),
        graceDays: Math.min(Math.max(Number(b.graceDays ?? current?.graceDays ?? 7) || 7, 1), 60),
        notes: String(b.notes ?? current?.notes ?? '').slice(0, 500),
        createdAt: current?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
      }
      await store.put(rec)
      return json(200, { ok: true, licence: await full(store, rec) })
    }
  }
  return json(404, { ok: false, error: 'Not found.' })
}

export default {
  fetch: (req: Request, env: Env): Promise<Response> => handle(req, env, d1Store(env.DB)),
}

const ADMIN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Licences · Back Moon Devs</title>
<style>
:root{color-scheme:light dark;--bg:#f6f7f9;--card:#fff;--ink:#16181d;--muted:#5a616d;--line:#d9dde4;--accent:#E8382C;--ok:#137a3e;--warn:#9a5b00;--bad:#b42318;--gold:#8a6d00}
@media (prefers-color-scheme:dark){:root{--bg:#121417;--card:#1b1e23;--ink:#eceef2;--muted:#a3a9b4;--line:#2d323a;--ok:#4cc38a;--warn:#e0a84b;--bad:#f07167;--gold:#e3c15a}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,Segoe UI,sans-serif;background:var(--bg);color:var(--ink)}
main{max-width:980px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0 0 4px}p.sub{margin:0 0 20px;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px}
label{display:block;font-size:13px;color:var(--muted);margin-bottom:4px}input{width:100%;font:inherit;font-size:16px;padding:9px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)}
button{font:inherit;font-weight:600;padding:9px 14px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;min-height:40px;touch-action:manipulation}
button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:1px}
button.go{background:var(--ok);border-color:var(--ok);color:#fff}button.stop{background:var(--warn);border-color:var(--warn);color:#fff}button.kill{background:var(--bad);border-color:var(--bad);color:#fff}button.life{background:var(--gold);border-color:var(--gold);color:#fff}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end}
.lic h2{font-size:18px;margin:0}.meta{color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.badge{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:8px;vertical-align:middle}
.b-active{background:color-mix(in srgb,var(--ok) 15%,transparent);color:var(--ok)}.b-suspended{background:color-mix(in srgb,var(--warn) 15%,transparent);color:var(--warn)}.b-deactivated{background:color-mix(in srgb,var(--bad) 15%,transparent);color:var(--bad)}.b-life{background:color-mix(in srgb,var(--gold) 18%,transparent);color:var(--gold)}
details{margin-top:12px;border-top:1px dashed var(--line);padding-top:8px}summary{cursor:pointer;color:var(--muted);font-size:13px;min-height:24px}
#msg{min-height:22px}.err{color:var(--bad)}.okm{color:var(--ok)}
</style></head><body><main>
<h1>Licences</h1><p class="sub">Back Moon Devs · switch a customer's copy on or off. A change reaches the customer's computer within about a minute while it is online, or at once when they press “Check again”.</p>
<form class="card" id="login"><label for="key">Admin key</label><div class="row"><input id="key" type="password" autocomplete="current-password" spellcheck="false" required><button type="submit">Open</button></div></form>
<div id="msg" role="status" aria-live="polite"></div>
<section id="list" hidden></section>
<form class="card" id="add" hidden><h2 style="font-size:16px;margin:0 0 12px">Add a licence</h2>
<div class="row"><div><label for="nid">Licence id</label><input id="nid" placeholder="e.g. VPP-2026-01…" spellcheck="false" autocomplete="off" required></div>
<div><label for="ncust">Customer</label><input id="ncust" placeholder="Company name…" autocomplete="off"></div>
<div><label for="ngrace">Offline days allowed</label><input id="ngrace" type="number" inputmode="numeric" min="1" max="60" value="7"></div><button type="submit">Add</button></div></form>
</main><script>
const $=(s)=>document.querySelector(s);let key=sessionStorage.getItem('k')||'';
const say=(t,bad)=>{$('#msg').className=bad?'err':'okm';$('#msg').textContent=t};
const api=async(method,body)=>{const r=await fetch('/admin/api/licences',{method,headers:{'authorization':'Bearer '+key,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!j.ok)throw new Error(j.error||'Failed');return j};
const esc=(s)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const when=(s)=>s?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(s)):'never';
const btn=(cls,act,text)=>'<button type="button" class="'+cls+'" data-a="'+act+'">'+text+'</button>';
async function load(){try{const {licences}=await api('GET');$('#login').hidden=true;$('#add').hidden=false;const L=$('#list');L.hidden=false;
L.innerHTML=licences.length?'':'<p class="card">No licences yet.</p>';
for(const l of licences){const life=l.permanent&&l.status==='active';const c=document.createElement('article');c.className='card lic';
const fields='<div class="row"><div><label>Message shown while suspended</label><input data-f="message" value="'+esc(l.message)+'" placeholder="e.g. Payment pending — call 89400 95659…"></div>'+
(l.permanent?'':'<div><label>Offline days allowed</label><input data-f="graceDays" type="number" inputmode="numeric" min="1" max="60" value="'+l.graceDays+'"></div>')+'</div>';
const hidden=btn('stop','suspend','Suspend')+btn('kill','deactivate','Deactivate')+(l.permanent?btn('','unlife','Remove lifetime'):'');
c.innerHTML='<h2>'+esc(l.licenceId)+(life?'<span class="badge b-life">LIFETIME</span>':'<span class="badge b-'+l.status+'">'+l.status.toUpperCase()+'</span>')+'</h2>'+
'<p class="meta">'+esc(l.customer||'No customer name')+' · last seen '+when(l.lastSeen)+(l.lastVersion?' · '+esc(l.lastVersion):'')+'</p>'+fields+
(life?'<div class="actions">'+btn('','save','Save message')+'</div><details><summary>More options</summary><div class="actions">'+hidden+'</div></details>'
:'<div class="actions">'+btn('go','activate','Activate')+btn('life','life','Activate for lifetime')+btn('stop','suspend','Suspend')+btn('kill','deactivate','Deactivate')+btn('','save','Save message')+'</div>'+(l.permanent?'<details><summary>More options</summary><div class="actions">'+btn('','unlife','Remove lifetime')+'</div></details>':''));
c.querySelectorAll('button[data-a]').forEach(b=>b.onclick=async()=>{const a=b.dataset.a;
if(a==='life'&&!confirm('Activate '+l.licenceId+' for LIFETIME? Only when the full payment is received. The copy then works without internet for good.'))return;
if(a==='deactivate'&&!confirm('Deactivate '+l.licenceId+'? The customer\\'s copy locks until you activate it again.'))return;
if(a==='suspend'&&l.permanent&&!confirm('Suspend a LIFETIME licence? It locks the next time the customer\\'s computer is online.'))return;
const patch={licenceId:l.licenceId,message:c.querySelector('[data-f=message]').value.trim()};const g=c.querySelector('[data-f=graceDays]');if(g)patch.graceDays=Number(g.value);
if(a==='activate')patch.status='active';if(a==='suspend')patch.status='suspended';if(a==='deactivate')patch.status='deactivated';
if(a==='life'){patch.status='active';patch.permanent=true}if(a==='unlife')patch.permanent=false;
b.disabled=true;try{await api('POST',patch);say(l.licenceId+' saved.');await load()}catch(e){say(e.message,true)}finally{b.disabled=false}});
L.appendChild(c)}}catch(e){say(e.message,true);$('#login').hidden=false}}
$('#login').onsubmit=(e)=>{e.preventDefault();key=$('#key').value.trim();sessionStorage.setItem('k',key);load()};
$('#add').onsubmit=async(e)=>{e.preventDefault();try{await api('POST',{licenceId:$('#nid').value.trim().toUpperCase(),customer:$('#ncust').value.trim(),graceDays:Number($('#ngrace').value),status:'active'});say('Licence added.');$('#add').reset();await load()}catch(err){say(err.message,true)}};
if(key)load();
</script></body></html>`
