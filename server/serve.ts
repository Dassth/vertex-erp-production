/* ---------------------------------------------------------------------------
 * Start serving one database: the HTTP server, the minute sweep, scheduled
 * backups (with an optional second copy elsewhere) and the licence check.
 * Shared by `main.js serve` and the Windows desktop package (desktop.ts).
 * ------------------------------------------------------------------------- */

import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { Database } from './storage'
import { VertexService } from './service'
import { createHttpServer } from './http'
import { runBackup } from './backup'
import { fsBackupStore } from './backup-fs'
import type { LicenceGuard } from './licence'

export interface ServeConfig {
  db: Database
  /** Printed once the server listens. */
  label: string
  port: number
  staticDir?: string
  secureCookies?: boolean
  allowedOrigins?: string[]
  deployment: string
  backup?: {
    dir: string
    /** A second place (another drive, a USB disk, a synced folder) that keeps one archive per day. */
    copyDir?: string
    /** Days of daily archives kept in `copyDir`. */
    copyDays?: number
    keep: number
    everyMin: number
    passphrase?: string
    appVersion: string
  }
  licence?: LicenceGuard
  /** The second computer may fetch a copy of the data with this code. */
  replica?: { pairCode: string }
  log?: (line: string) => void
}

const ARCHIVE = /^vertex-erp-backup-(\d{4}-\d{2}-\d{2})-\d{6}Z\.zip$/

/**
 * Copy the newest archive to the second place, keeping one archive per day
 * for `days` days. A missing drive is reported, never fatal.
 */
export function copyToSecondPlace(fromDir: string, name: string, toDir: string, days: number): string {
  mkdirSync(toDir, { recursive: true })
  copyFileSync(join(fromDir, name), join(toDir, name))
  const day = ARCHIVE.exec(name)?.[1]
  const archives = readdirSync(toDir).filter((f) => ARCHIVE.test(f)).sort()
  for (const f of archives) if (f !== name && ARCHIVE.exec(f)?.[1] === day) unlinkSync(join(toDir, f))
  const kept = readdirSync(toDir).filter((f) => ARCHIVE.test(f)).sort()
  for (const f of kept.slice(0, Math.max(0, kept.length - days))) unlinkSync(join(toDir, f))
  return join(toDir, name)
}

export async function startServing(cfg: ServeConfig): Promise<{ stop: () => Promise<void> }> {
  const log = cfg.log ?? ((l: string) => console.log(l))
  const { db } = cfg
  const service = new VertexService(db)
  await service.ensureState()
  const b = cfg.backup
  const server = createHttpServer(service, {
    staticDir: cfg.staticDir,
    secureCookies: !!cfg.secureCookies,
    allowedOrigins: cfg.allowedOrigins ?? [],
    deployment: cfg.deployment,
    licence: cfg.licence,
    replica: cfg.replica,
    backup: b ? { store: fsBackupStore(b.dir), passphrase: b.passphrase, appVersion: b.appVersion, keep: b.keep, schedule: `every ${b.everyMin} min${b.copyDir ? `, daily copy in ${b.copyDir}` : ''}` } : undefined,
  })
  await new Promise<void>((resolve) => server.listen(cfg.port, resolve))
  log(`Vertex ERP server on http://localhost:${cfg.port} (${cfg.label}${cfg.staticDir ? `, serving ${cfg.staticDir}` : ', API only'})`)

  const sweep = setInterval(() => service.sweep().catch((e) => log(`sweep failed: ${e}`)), 60_000)
  const stopLicence = cfg.licence?.start(30)

  let backups: NodeJS.Timeout | null = null
  if (b && b.everyMin > 0) {
    if (!b.passphrase) log('Backups do not contain account passwords (no VERTEX_BACKUP_PASSPHRASE): after a restore each administrator sets a new password.')
    const run = async () => {
      try {
        const { name, manifest } = await runBackup(db, fsBackupStore(b.dir), { passphrase: b.passphrase, appVersion: b.appVersion, keep: b.keep })
        log(`backup written: ${join(b.dir, name)} (revision ${manifest.database.revision})`)
        if (b.copyDir) {
          try {
            log(`backup copied: ${copyToSecondPlace(b.dir, name, b.copyDir, b.copyDays ?? 400)}`)
          } catch (e) {
            log(`second backup copy FAILED (${b.copyDir} not reachable?): ${e instanceof Error ? e.message : e}`)
          }
        }
      } catch (e) {
        log(`scheduled backup FAILED: ${e instanceof Error ? e.stack : e}`)
      }
    }
    void run()
    backups = setInterval(run, b.everyMin * 60_000)
  } else {
    log('Scheduled backups are OFF — set BACKUP_DIR (on separate storage) to enable them.')
  }

  return {
    stop: async () => {
      clearInterval(sweep)
      if (backups) clearInterval(backups)
      stopLicence?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await db.close()
    },
  }
}

