/* Backup archives on a local or mounted directory (Node server). */

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { ArchiveListing, BackupStatus, BackupStore } from './backup'
import { ARCHIVE_NAME, EMPTY_STATUS, peekManifest } from './backup'

const STATUS_FILE = 'backup-status.json'

export function fsBackupStore(dir: string): BackupStore {
  const root = resolve(dir)
  const path = (name: string) => {
    if (!ARCHIVE_NAME.test(name)) throw new Error('Invalid backup name.')
    return join(root, name)
  }
  return {
    label: root,
    async put(name, data) {
      await mkdir(root, { recursive: true })
      await writeFile(path(name), data, { flag: 'wx' })
    },
    async get(name) {
      try {
        return await readFile(path(name))
      } catch {
        return null
      }
    },
    async list() {
      let names: string[] = []
      try {
        names = (await readdir(root)).filter((f) => ARCHIVE_NAME.test(f)).sort().reverse()
      } catch {
        return []
      }
      const out: ArchiveListing[] = []
      for (const name of names) {
        const file = join(root, name)
        const [info, data] = await Promise.all([stat(file), readFile(file)])
        out.push({ name, size: info.size, ...peekManifest(data) })
      }
      return out
    },
    async remove(name) {
      await rm(path(name))
    },
    async readStatus(): Promise<BackupStatus> {
      try {
        return { ...EMPTY_STATUS, ...JSON.parse(await readFile(join(root, STATUS_FILE), 'utf8')) }
      } catch {
        return { ...EMPTY_STATUS }
      }
    },
    async writeStatus(status) {
      await mkdir(root, { recursive: true })
      await writeFile(join(root, STATUS_FILE), JSON.stringify(status, null, 1))
    },
  }
}
