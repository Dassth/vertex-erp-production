// Opens the customer-demo dataset in a visible Chromium window.
//
// The demo records (Vertex Print Pack (TEST), JOB-0001, INV/2026-27/0001-0002,
// JOB-0002 …) are FICTIONAL and live only in e2e/.playwright-profile against the
// dev server on http://localhost:5180. Start that server first
// (preview config "vertex-erp-isolated", or `npm run dev -- --port 5180 --strictPort`).
//
// Close this window before running the acceptance suite: both use the same profile.
//
//   node e2e/open-demo.mjs            → visible window, stays open until you close it
//   DEMO_CHECK=1 node e2e/open-demo.mjs → headless self-check, prints what it sees, exits
import { chromium } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:5180'
const check = process.env.DEMO_CHECK === '1'
const profile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.playwright-profile')

const context = await chromium.launchPersistentContext(profile, {
  headless: check,
  viewport: check ? { width: 1280, height: 800 } : null,
  args: check ? ['--disable-gpu'] : ['--start-maximized'],
  acceptDownloads: true,
})
const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[name="account"]', { timeout: 30_000 })

if (check) {
  const seen = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('vertex-erp-db-v2') ?? 'null')
    return db && {
      company: db.company.name,
      orders: db.orders.map((o) => `${o.code} ${o.status} qty ${o.quantity}`),
      invoices: db.invoices.map((i) => i.number),
      dispatched: db.dispatches.reduce((s, d) => s + d.quantity, 0),
    }
  })
  console.log(JSON.stringify(seen, null, 1))
  await context.close()
} else {
  console.log(`Demo window open at ${BASE}/login — close the window to finish.`)
  await new Promise((resolve) => context.on('close', resolve))
}
