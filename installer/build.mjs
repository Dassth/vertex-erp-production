/* ---------------------------------------------------------------------------
 * Build the Windows offline installer:  release\VertexERP-Setup-<licence>.exe
 *
 *   node installer/build.mjs --licence VPP-2026-01 --customer "Vertex Print Pack"
 *
 * Stages Node, the server bundle, the web app, PostgreSQL 17 and an icon, packs
 * them into payload.zip, and wraps payload + setup into one EXE with Windows'
 * own IExpress — nothing is downloaded. Run on Windows.
 * ------------------------------------------------------------------------- */

import { execFileSync, execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : fallback
}
const LICENCE = (arg('--licence') ?? '').toUpperCase()
const CUSTOMER = arg('--customer', '')
if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(LICENCE)) throw new Error('Pass --licence <ID>, e.g. --licence VPP-2026-01 (create it first on the licence control page).')
if (/['@]/.test(CUSTOMER)) throw new Error('The customer name may not contain \' or @.')
const now = new Date()
const p2 = (n) => String(n).padStart(2, '0')
// Every build gets its own number (date and time), shown in the app and compared by open windows.
const VERSION = `${now.getFullYear()}.${p2(now.getMonth() + 1)}.${p2(now.getDate())}.${p2(now.getHours())}${p2(now.getMinutes())}`

const REL = join(ROOT, 'release')
const STAGE = join(REL, 'stage')
const PACK = join(REL, 'pack')
const step = (t) => console.log(`\n== ${t}`)
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_VERTEX_BUILD: VERSION } })

step('Clean')
rmSync(STAGE, { recursive: true, force: true })
rmSync(PACK, { recursive: true, force: true })
mkdirSync(join(STAGE, 'app'), { recursive: true })
mkdirSync(PACK, { recursive: true })

step('Type-check and build the web app (server storage mode)')
run('npx tsc -b')
run(`npx vite build --mode server --outDir "${join(STAGE, 'app', 'client')}" --emptyOutDir`)

step('Build the server (one file, no node_modules)')
run('npx vite build --config vite.desktop.config.ts')
if (!existsSync(join(STAGE, 'app', 'main.js'))) throw new Error('Server bundle missing.')

step('Node runtime')
mkdirSync(join(STAGE, 'node'), { recursive: true })
cpSync(process.execPath, join(STAGE, 'node', 'node.exe'))
console.log(`node ${process.version}`)

step('PostgreSQL 17')
const pgRoot = join(ROOT, 'node_modules', '@embedded-postgres', 'windows-x64', 'native')
for (const part of ['bin', 'lib', 'share']) cpSync(join(pgRoot, part), join(STAGE, 'pgsql', part), { recursive: true })
cpSync(join(ROOT, 'node_modules', '@embedded-postgres', 'windows-x64', 'LICENSE.md'), join(STAGE, 'pgsql', 'LICENSE.md'))

step('Icon')
await makeIcon(join(ROOT, 'public', 'vertex.svg'), join(STAGE, 'VertexERP.ico'))

step('Scripts and version')
cpSync(join(ROOT, 'installer', 'uninstall.ps1'), join(STAGE, 'uninstall.ps1'))
writeFileSync(join(STAGE, 'app', 'version.json'), JSON.stringify({ version: VERSION, licenceId: LICENCE, customer: CUSTOMER, builtAt: now.toISOString(), node: process.version }, null, 2))

step('Pack payload.zip')
const payload = join(PACK, 'payload.zip')
execFileSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-c', '-f', payload, '-C', STAGE, '.'], { stdio: 'inherit' })
console.log(`payload ${(statSync(payload).size / 1048576).toFixed(1)} MB`)

step('Setup files')
const setup = readFileSync(join(ROOT, 'installer', 'setup.ps1'), 'utf8').replaceAll('@@LICENCE_ID@@', LICENCE).replaceAll('@@CUSTOMER@@', CUSTOMER).replaceAll('@@VERSION@@', VERSION)
if ([...setup].some((c) => c.charCodeAt(0) > 127)) throw new Error('setup.ps1 must stay plain ASCII.')
writeFileSync(join(PACK, 'setup.ps1'), setup)
writeFileSync(join(PACK, 'setup.cmd'), '@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0setup.ps1" -Payload "%~dp0payload.zip"\r\n')
cpSync(join(STAGE, 'VertexERP.ico'), join(PACK, 'VertexERP.ico'))

step('Wrap into one EXE (IExpress)')
const exe = join(REL, `VertexERP-Setup-${LICENCE}.exe`)
rmSync(exe, { force: true })
const files = ['setup.cmd', 'setup.ps1', 'payload.zip', 'VertexERP.ico']
const sed = [
  '[Version]',
  'Class=IEXPRESS',
  'SEDVersion=3',
  '[Options]',
  'PackagePurpose=InstallApp',
  'ShowInstallProgramWindow=1',
  'HideExtractAnimation=0',
  'UseLongFileName=1',
  'InsideCompressed=0',
  'CAB_FixedSize=0',
  'CAB_ResvCodeSigning=0',
  'RebootMode=N',
  'InstallPrompt=%InstallPrompt%',
  'DisplayLicense=%DisplayLicense%',
  'FinishMessage=%FinishMessage%',
  'TargetName=%TargetName%',
  'FriendlyName=%FriendlyName%',
  'AppLaunched=%AppLaunched%',
  'PostInstallCmd=%PostInstallCmd%',
  'AdminQuietInstCmd=%AdminQuietInstCmd%',
  'UserQuietInstCmd=%UserQuietInstCmd%',
  'SourceFiles=SourceFiles',
  '[Strings]',
  'InstallPrompt=',
  'DisplayLicense=',
  'FinishMessage=',
  `TargetName=${exe}`,
  `FriendlyName=Vertex ERP Setup - ${CUSTOMER || LICENCE}`,
  'AppLaunched=cmd.exe /c setup.cmd',
  'PostInstallCmd=<None>',
  'AdminQuietInstCmd=',
  'UserQuietInstCmd=',
  ...files.map((f, i) => `FILE${i}="${f}"`),
  '[SourceFiles]',
  `SourceFiles0=${PACK}\\`,
  '[SourceFiles0]',
  ...files.map((_, i) => `%FILE${i}%=`),
].join('\r\n')
const sedPath = join(PACK, 'setup.sed')
writeFileSync(sedPath, sed)
execFileSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'iexpress.exe'), ['/N', '/Q', sedPath], { stdio: 'inherit' })
if (!existsSync(exe)) throw new Error('IExpress did not produce the setup EXE.')
console.log(`\nDone: ${exe} (${(statSync(exe).size / 1048576).toFixed(1)} MB) — licence ${LICENCE}, version ${VERSION}`)

/** Render the SVG logo at 256 px and wrap the PNG in an .ico container. */
async function makeIcon(svgPath, icoPath) {
  const require = createRequire(join(ROOT, 'package.json'))
  const { chromium } = require('playwright-core')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 256, height: 256 } })
    const svg = readFileSync(svgPath, 'utf8')
    await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:256px;height:256px">${svg.replace('<svg', '<svg width="256" height="256"')}</div></body></html>`)
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 256, height: 256 } })
    const head = Buffer.alloc(22)
    head.writeUInt16LE(0, 0) // reserved
    head.writeUInt16LE(1, 2) // icon
    head.writeUInt16LE(1, 4) // one image
    head.writeUInt8(0, 6) // 256 px wide
    head.writeUInt8(0, 7) // 256 px high
    head.writeUInt16LE(1, 10) // planes
    head.writeUInt16LE(32, 12) // bits per pixel
    head.writeUInt32LE(png.length, 14)
    head.writeUInt32LE(22, 18)
    writeFileSync(icoPath, Buffer.concat([head, png]))
  } finally {
    await browser.close()
  }
}
