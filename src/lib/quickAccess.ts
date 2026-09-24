/* ---------------------------------------------------------------------------
 * Quick access — type what you want to do, go straight there.
 *
 * Two kinds of destination:
 *   • places  — a fixed list of screens and actions ("make a purchase bill")
 *   • records — live plans, orders, customers, invoices, bills and products,
 *               found by code, number or name ("Lalchand", "INV/2026-27/0001")
 *
 * Ranking is plain text matching, not a language model: the query is reduced to
 * meaningful words (so "I want to…" and "show me the…" are ignored), each word
 * is matched against the title, keywords and description, and the result is
 * lifted by two things the app knows — what this account uses most (learned
 * from its own picks) and what needs attention today.
 * ------------------------------------------------------------------------- */

import type { Capability } from './permissions'
import type { VertexDB } from './types'

export interface QuickTarget {
  id: string
  title: string
  hint: string
  to: string
  group: 'Do' | 'Go to' | 'Plans' | 'Jobs' | 'Customers' | 'Invoices' | 'Purchases' | 'Products' | 'Setup'
  keywords: string[]
  /** Who may see it: a capability, or undefined for everyone. */
  need?: Capability
}

export interface ScoredTarget extends QuickTarget {
  score: number
  /** Why it is being suggested when nothing is typed. */
  reason?: string
}

/* Words that carry no meaning on their own ("I want to take a bill"). */
const NOISE = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at', 'is', 'am', 'are', 'it',
  'this', 'that', 'there', 'here', 'about', 'with', 'from', 'and', 'or', 'any', 'some', 'want', 'wanna', 'need',
  'needed', 'like', 'would', 'could', 'should', 'can', 'may', 'must', 'have', 'has', 'had', 'do', 'does', 'did',
  'please', 'pls', 'plz', 'kindly', 'show', 'give', 'get', 'go', 'goto', 'open', 'see', 'view', 'take', 'find',
  'search', 'where', 'what', 'which', 'who', 'when', 'how', 'why', 'now', 'today', 'again', 'just', 'let', 'lets',
])

/** What the sentence is asking for, read from the words around the topic. */
export type Intent = 'do' | 'goto' | 'setting' | 'help' | 'problem' | 'none'

const INTENT_PATTERNS: Array<[Intent, RegExp]> = [
  ['problem', /\b(problem|problems|issue|issues|error|errors|wrong|broken|stuck|not working|doesn'?t work|failed|failing|complaint|complain)\b/],
  ['help', /\b(help|support|question|questions|doubt|doubts|guide|tutorial|explain|teach|suggestion|suggestions|feedback|idea|how do i|how to|what is)\b/],
  ['setting', /\b(setting|settings|configure|configuration|setup|set up|preference|preferences)\b/],
  ['do', /\b(make|create|add|new|record|enter|raise|issue|prepare|download|print|generate|send|take|want|need)\b/],
  ['goto', /\b(where|open|show|see|view|go|visit|list)\b/],
]

/** Words people use for the same thing in this trade. */
const SYNONYMS: Record<string, string[]> = {
  bill: ['invoice'],
  invoice: ['bill'],
  bills: ['invoice'],
  buy: ['purchase'],
  buying: ['purchase'],
  bought: ['purchase'],
  inward: ['purchase'],
  sell: ['sales'],
  sold: ['sales'],
  selling: ['sales'],
  outward: ['sales'],
  party: ['customer'],
  client: ['customer'],
  buyer: ['customer'],
  vendor: ['supplier'],
  tax: ['gst'],
  gst: ['tax'],
  worker: ['staff'],
  workers: ['staff'],
  people: ['staff'],
  employee: ['staff'],
  operator: ['staff'],
  press: ['machine'],
  lorry: ['transport'],
  truck: ['transport'],
  courier: ['dispatch'],
  shipment: ['dispatch'],
  delivery: ['dispatch'],
  money: ['invoice'],
  payment: ['invoice'],
  paid: ['invoice'],
  cost: ['costing'],
  rate: ['costing'],
  quotation: ['costing'],
  quote: ['costing'],
  stock: ['material'],
  paper: ['material'],
  board: ['material'],
  change: ['edit'],
  update: ['edit'],
  modify: ['edit'],
  correct: ['edit'],
  delete: ['remove'],
  monitor: ['production'],
  status: ['progress'],
  support: ['help'],
  doubt: ['help'],
  question: ['help'],
}

export const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9/\-. ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/** A word from the query: either typed, or one we added because it means the same. */
export interface Token {
  word: string
  derived: boolean
}

/** The sentence reduced to what it is actually asking for. */
export function parse(query: string): { intent: Intent; tokens: Token[]; phrase: string } {
  const text = query.toLowerCase().trim()
  const intent = INTENT_PATTERNS.find(([, re]) => re.test(text))?.[0] ?? 'none'
  const typed = words(text).filter((w) => !NOISE.has(w))
  const seen = new Set(typed)
  const tokens: Token[] = typed.map((word) => ({ word, derived: false }))
  for (const w of typed)
    for (const syn of SYNONYMS[w] ?? [])
      if (!seen.has(syn)) {
        seen.add(syn)
        tokens.push({ word: syn, derived: true })
      }
  return { intent, tokens, phrase: text }
}

/** One edit apart, e.g. "purchse" and "purchase" — enough for a typed word. */
function nearlyEqual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  if (a === b) return true
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i += 1
    else if (a.length < b.length) j += 1
    else {
      i += 1
      j += 1
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** The fixed screens and actions of the app. */
export function places(): QuickTarget[] {
  return [
    // Do
    { id: 'plan.new', title: 'Create a new plan', hint: 'Plan an order for a customer', to: '/planning/new', group: 'Do', need: 'planning', keywords: ['new', 'create', 'make', 'add', 'plan', 'order', 'job', 'enquiry', 'start'] },
    { id: 'purchase.new', title: 'Record a purchase bill', hint: 'Billing → Purchase → New purchase bill', to: '/billing?tab=purchase&new=1', group: 'Do', need: 'billing', keywords: ['purchase', 'bill', 'buy', 'bought', 'supplier', 'seller', 'material', 'paper', 'board', 'make', 'new', 'add', 'entry', 'inward'] },
    { id: 'dispatch.new', title: 'Dispatch an order', hint: 'Send finished goods and issue the invoice', to: '/dispatch', group: 'Do', need: 'dispatch', keywords: ['dispatch', 'ship', 'send', 'delivery', 'deliver', 'lorry', 'transport', 'invoice', 'issue'] },
    { id: 'dispatch.receive', title: 'Confirm a delivery was received', hint: 'Mark a shipment received so its invoice can be downloaded', to: '/dispatch', group: 'Do', need: 'dispatch', keywords: ['received', 'receipt', 'confirm', 'delivered', 'acknowledge', 'proof'] },
    { id: 'invoice.download', title: 'Download a sales invoice', hint: 'Billing → Sales → the order → Download', to: '/billing', group: 'Do', need: 'billing', keywords: ['invoice', 'bill', 'download', 'pdf', 'print', 'sales', 'customer', 'copy'] },
    { id: 'invoice.gst', title: 'Edit GST on an invoice', hint: 'Change the GST %, CGST/SGST or IGST split, or HSN', to: '/billing', group: 'Do', need: 'billing', keywords: ['gst', 'tax', 'cgst', 'sgst', 'igst', 'hsn', 'edit', 'change', 'correct', 'rate', 'percent'] },
    { id: 'report.gst', title: 'Monthly GST report for the auditor', hint: 'Annexure-I: sales and purchase registers', to: '/reports?report=gst', group: 'Do', need: 'billing', keywords: ['gst', 'report', 'annexure', 'auditor', 'return', 'monthly', 'filing', 'tax', 'excel'] },
    { id: 'report.invoice', title: 'Invoice report (sales or purchase)', hint: 'Every invoice or bill of a month with its items', to: '/reports?report=invoice', group: 'Do', need: 'billing', keywords: ['report', 'invoice', 'register', 'month', 'excel', 'csv', 'download', 'sales', 'purchase'] },
    { id: 'customer.history', title: 'Customer history', hint: 'What a customer ordered, from any year', to: '/customers', group: 'Do', need: 'billing', keywords: ['customer', 'history', 'past', 'orders', 'buyer', 'party', 'client', 'old'] },
    { id: 'jobcard', title: 'Job card for a plan', hint: 'Planning → the plan → Plan or Live job card', to: '/planning', group: 'Do', need: 'planning', keywords: ['job', 'card', 'jobcard', 'route', 'shop', 'floor', 'print', 'live', 'progress', 'download'] },

    { id: 'help.guide', title: 'How the workflow works', hint: 'Step-by-step guide: Master → Planning → Costing → Production → Billing', to: '/home?guide=1', group: 'Do', keywords: ['help', 'guide', 'how', 'question', 'doubt', 'support', 'learn', 'explain', 'steps', 'workflow', 'training', 'tutorial'] },
    { id: 'help.problem', title: 'Something is wrong — what needs attention', hint: 'Problems reported by units, late jobs and unconfirmed deliveries', to: '/home', group: 'Do', need: 'billing', keywords: ['problem', 'issue', 'wrong', 'error', 'stuck', 'delay', 'late', 'attention', 'complaint', 'broken', 'help'] },
    { id: 'help.support', title: 'Report a problem on a process', hint: 'Units → the unit → the process → Report a problem', to: '/units', group: 'Do', need: 'production.work', keywords: ['problem', 'issue', 'report', 'machine', 'breakdown', 'stop', 'help', 'support', 'stuck'] },
    { id: 'go.units', title: 'Units — allocate, record and print each unit’s jobs', hint: 'Open a unit, then a job, to print its job sheet', to: '/units', group: 'Go to', need: 'units.monitor', keywords: ['print', 'sheet', 'whatsapp', 'send', 'allocate', 'allocation', 'start', 'complete', 'unit', 'units', 'shop', 'floor', 'monitor', 'watch', 'team', 'load', 'u1', 'u2', 'u3', 'u4'] },

    // Go to
    { id: 'go.home', title: 'Home', hint: 'What needs you today', to: '/home', group: 'Go to', need: 'billing', keywords: ['home', 'dashboard', 'start', 'overview'] },
    { id: 'go.planning', title: 'Planning', hint: 'All plans', to: '/planning', group: 'Go to', need: 'planning', keywords: ['planning', 'plans', 'schedule', 'allocate'] },
    { id: 'go.costing', title: 'Costing', hint: 'Cost and finalize a planned order', to: '/costing', group: 'Go to', need: 'costing', keywords: ['costing', 'cost', 'price', 'quote', 'rate', 'profit', 'finalize'] },
    { id: 'go.production', title: 'Production', hint: 'Process progress by unit', to: '/production', group: 'Go to', need: 'production.monitor', keywords: ['production', 'progress', 'jobs', 'work', 'board', 'timeline'] },
    { id: 'go.dispatch', title: 'Dispatch', hint: 'Ship completed orders', to: '/dispatch', group: 'Go to', need: 'dispatch', keywords: ['dispatch', 'shipping', 'delivery'] },
    { id: 'go.invoices', title: 'Invoices', hint: 'Order summaries and invoice downloads', to: '/invoices', group: 'Go to', need: 'billing', keywords: ['invoices', 'summary', 'cumulative', 'statement'] },
    { id: 'go.billing.sales', title: 'Billing — Sales', hint: 'Sales invoices for every order', to: '/billing', group: 'Go to', need: 'billing', keywords: ['billing', 'sales', 'invoice', 'money', 'revenue'] },
    { id: 'go.billing.purchase', title: 'Billing — Purchase', hint: 'Supplier bills you have recorded', to: '/billing?tab=purchase', group: 'Go to', need: 'billing', keywords: ['billing', 'purchase', 'supplier', 'expenses', 'inward'] },
    { id: 'go.reports', title: 'Reports', hint: 'Monthly invoice and GST reports', to: '/reports', group: 'Go to', need: 'billing', keywords: ['reports', 'monthly', 'download', 'excel'] },
    { id: 'go.customers', title: 'Customers', hint: 'Customer ID lookup and order history', to: '/customers', group: 'Go to', need: 'billing', keywords: ['customers', 'parties', 'clients', 'buyers'] },

    // Setup
    { id: 'go.master.products', title: 'Master — Products', hint: 'Stages, processes and materials', to: '/master/products', group: 'Setup', need: 'master', keywords: ['product', 'products', 'master', 'stages', 'processes', 'bom', 'material', 'box', 'design'] },
    { id: 'go.master.costing', title: 'Master — Costing', hint: 'Material prices and costing configuration', to: '/master/costing', group: 'Setup', need: 'master', keywords: ['master', 'costing', 'prices', 'material', 'rates', 'charges', 'tax', 'settings', 'configuration'] },
    { id: 'go.master.customers', title: 'Master — Customers', hint: 'Add or edit customers, GSTIN and addresses', to: '/master/customers', group: 'Setup', need: 'master', keywords: ['customer', 'add', 'new', 'edit', 'gstin', 'address', 'master', 'party'] },
    { id: 'go.settings', title: 'Settings', hint: 'Units, people, machines, accounts and data', to: '/settings', group: 'Setup', need: 'administration', keywords: ['settings', 'setting', 'change', 'people', 'staff', 'machines', 'accounts', 'users', 'backup', 'company', 'profile', 'admin', 'password'] },
  ]
}

/** Live records — only worth searching once something is typed. */
export function records(db: VertexDB, limitPerKind = 60): QuickTarget[] {
  const out: QuickTarget[] = []
  const customer = (id: string) => db.customers.find((c) => c.id === id)?.company ?? ''
  for (const p of db.plans.slice(-limitPerKind))
    out.push({ id: `plan:${p.id}`, title: p.code, hint: `Plan · ${customer(p.customerId)} · ${p.status}`, to: `/planning/${p.id}`, group: 'Plans', need: 'planning', keywords: [p.code, customer(p.customerId), p.customerRef, p.status, p.priority].filter(Boolean) })
  for (const o of db.orders.slice(-limitPerKind))
    out.push({ id: `order:${o.id}`, title: o.code, hint: `Job · ${o.customer.company} · ${o.productName}`, to: `/production?job=${o.id}`, group: 'Jobs', need: 'production.monitor', keywords: [o.code, o.customer.company, o.productName, o.customerRef].filter(Boolean) })
  for (const c of db.customers)
    out.push({ id: `customer:${c.id}`, title: c.company, hint: `Customer ${c.code}`, to: `/customers?id=${c.id}`, group: 'Customers', need: 'billing', keywords: [c.code, c.company, c.contactPerson, c.gstin, c.phone].filter(Boolean) })
  for (const i of db.invoices.slice(-limitPerKind))
    out.push({ id: `invoice:${i.id}`, title: i.number, hint: `Invoice · ${i.customer.company} · ${i.issueDate}`, to: `/billing?order=${i.orderId}`, group: 'Invoices', need: 'billing', keywords: [i.number, i.customer.company, i.refs.orderCode].filter(Boolean) })
  for (const b of (db.purchases ?? []).slice(-limitPerKind))
    out.push({ id: `purchase:${b.id}`, title: b.supplierInvoiceNo || b.code, hint: `Purchase bill · ${b.supplierName} · ${b.date}`, to: `/billing?tab=purchase&q=${encodeURIComponent(b.supplierInvoiceNo || b.code)}`, group: 'Purchases', need: 'billing', keywords: [b.code, b.supplierName, b.supplierInvoiceNo, ...b.lines.map((l) => l.description)].filter(Boolean) })
  for (const p of db.products.filter((x) => x.active).slice(0, limitPerKind))
    out.push({ id: `product:${p.id}`, title: p.name, hint: `Product ${p.code}`, to: `/master/products/${p.id}`, group: 'Products', need: 'master', keywords: [p.code, p.name, p.category, p.hsn].filter(Boolean) })
  return out
}

/* ------------------------------- Ranking ---------------------------------- */

/** "bills" and "bill" are the same word here. */
const stem = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

/** Entries that answer "help me" rather than "take me somewhere". */
const HELP_IDS = new Set(['help.guide', 'help.problem', 'help.support'])

function scoreOne(target: QuickTarget, tokens: Token[], phrase: string, intent: Intent): number {
  const title = target.title.toLowerCase()
  const titleWords = title.split(/[^a-z0-9]+/).filter(Boolean).map(stem)
  const hint = target.hint.toLowerCase()
  const keys = target.keywords.map((k) => k.toLowerCase())
  const keyStems = keys.map(stem)
  let score = target.group === 'Do' ? 8 : 0 // an action beats a page when the query is ambiguous
  let matched = 0

  if (phrase) {
    if (title === phrase) score += 140
    else if (title.includes(phrase)) score += 60
    if (keys.some((k) => k.includes(phrase))) score += 30
  }

  let typedWords = 0
  for (const raw of tokens) {
    const t = stem(raw.word)
    if (!raw.derived) typedWords += 1
    let best = 0
    // An exact word — in the title or as a deliberate synonym ("bill" → invoice) — is the strongest signal.
    if (titleWords.includes(t) || keyStems.includes(t)) best = 90
    else if (t.length >= 5 && [...titleWords, ...keyStems].some((w) => nearlyEqual(w, t))) best = 60 // typed in a hurry
    else if (titleWords.some((w) => w.startsWith(t))) best = 35
    else if (keyStems.some((k) => k.startsWith(t) || t.startsWith(k))) best = 26
    else if (title.includes(t)) best = 25
    else if (hint.includes(t)) best = 12
    // A word we added ourselves counts, but never more than the words actually typed.
    if (best && raw.derived) best = Math.round(best * 0.7)
    else if (best) matched += 1
    score += best
  }
  if (!matched) return 0

  // What the sentence asks for decides between an action, a page and an answer.
  if (intent === 'do' && target.group === 'Do') score += 14
  if (intent === 'goto' && target.group === 'Go to') score += 14
  if (intent === 'setting' && target.group === 'Setup') score += 20
  if ((intent === 'help' || intent === 'problem') && HELP_IDS.has(target.id)) score += 45
  // (a topic beats the general help entry — see rank())

  // Every word matching something is a much better answer than one word matching.
  const coverage = matched / Math.max(1, typedWords)
  if (coverage < 0.4) return 0
  return score * (0.6 + 0.4 * coverage)
}

export interface RankOptions {
  /** id → how often this account picked it (learned locally). */
  usage?: Record<string, number>
  /** id → extra weight because it needs attention today. */
  context?: Record<string, number>
  limit?: number
}

export function rank(targets: QuickTarget[], query: string, opts: RankOptions = {}): ScoredTarget[] {
  const { intent, tokens, phrase } = parse(query)
  if (!tokens.length) {
    // "I have a question" on its own: no topic, but the intent is clear.
    if (intent === 'help' || intent === 'problem') return targets.filter((t) => HELP_IDS.has(t.id)).map((t) => ({ ...t, score: 1 }))
    return []
  }
  const { usage = {}, context = {}, limit = 8 } = opts
  const scored = targets.map((t) => ({ ...t, score: scoreOne(t, tokens, phrase, intent) }))
  // "A question about GST" is a question about GST: when the sentence names a
  // topic the app knows, that answer leads and general help steps back.
  const topical = Math.max(0, ...scored.filter((t) => !HELP_IDS.has(t.id)).map((t) => t.score))
  return scored
    .map((t) => (topical >= 90 && HELP_IDS.has(t.id) ? { ...t, score: t.score * 0.7 } : t))
    .map((t) => (t.score ? { ...t, score: t.score + Math.min(usage[t.id] ?? 0, 6) * 12 + (context[t.id] ?? 0) } : t))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

/**
 * What to offer before anything is typed: today's real needs first, then the
 * actions this account reaches for most, then a sensible default set.
 */
export function suggestions(db: VertexDB, targets: QuickTarget[], opts: { usage?: Record<string, number>; now?: Date; limit?: number } = {}): ScoredTarget[] {
  const { usage = {}, now = new Date(), limit = 6 } = opts
  const byId = new Map(targets.map((t) => [t.id, t]))
  const out: ScoredTarget[] = []
  const add = (id: string, reason: string) => {
    const t = byId.get(id)
    if (t && !out.some((x) => x.id === id)) out.push({ ...t, score: 0, reason })
  }

  const awaiting = db.dispatches.filter((d) => !d.receivedAt).length
  if (awaiting) add('dispatch.receive', `${awaiting} shipment(s) awaiting receipt`)
  const ready = db.orders.filter((o) => o.status === 'Completed' && db.dispatches.filter((d) => d.orderId === o.id).reduce((s, d) => s + d.quantity, 0) < o.completedQty).length
  if (ready) add('dispatch.new', `${ready} order(s) ready to dispatch`)
  const urgent = db.plans.filter((p) => p.priority === 'Urgent' && (p.status === 'Draft' || p.status === 'Ready for Costing')).length
  if (urgent) add('go.planning', `${urgent} urgent plan(s) open`)
  const forCosting = db.plans.filter((p) => p.status === 'Ready for Costing').length
  if (forCosting) add('go.costing', `${forCosting} plan(s) waiting in costing`)
  // In the first week of a month, last month's return is the live job.
  if (now.getDate() <= 10) add('report.gst', 'GST report for last month')

  for (const [id] of Object.entries(usage).sort((a, b) => b[1] - a[1])) add(id, 'You use this often')
  for (const id of ['plan.new', 'purchase.new', 'invoice.download', 'go.production', 'unit.allocations', 'unit.work']) add(id, 'Common action')

  return out.slice(0, limit)
}
