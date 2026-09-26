import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileCheck2, FolderOpen, HardDriveDownload, RefreshCw, Save, Upload } from 'lucide-react'
import { useStore } from '../../store/store'
import { remote } from '../../store/remote'
import type { BackupStatusResponse, BackupValidation } from '../../store/remote'
import { fmtDateTime } from '../../lib/format'
import { Badge, Button, Card, CardHead, ConfirmDialog } from '../../components/ui'

const COUNT_LABELS: Array<[string, string]> = [
  ['products', 'Products'],
  ['materials', 'Materials'],
  ['customers', 'Customers'],
  ['plans', 'Plans'],
  ['costings', 'Costings'],
  ['orders', 'Orders'],
  ['dispatches', 'Dispatches'],
  ['invoices', 'Invoices'],
  ['purchases', 'Purchase bills'],
  ['moneyEntries', 'Income & expenses'],
  ['people', 'People'],
  ['machines', 'Machines'],
  ['users', 'Accounts'],
  ['drafts', 'Saved drafts'],
]

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024)).toLocaleString('en-IN')} KB`

/** Administrator 1 only: the Settings route is administration-only and the server re-checks every call. */
export function BackupPanel() {
  const { storageMode, pushToast } = useStore()
  const [info, setInfo] = useState<BackupStatusResponse | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [checking, setChecking] = useState(false)
  const [validation, setValidation] = useState<{ file: string; result: BackupValidation } | null>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const [confirmImport, setConfirmImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<string | null>(null)
  const [needFile, setNeedFile] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await remote.backupStatus()
      if (r.body.ok) {
        setInfo(r.body)
        setError('')
      } else setError(r.body.error)
    } catch {
      setError('The server could not be reached.')
    }
  }, [])

  useEffect(() => {
    if (storageMode === 'server') void load()
  }, [storageMode, load])

  if (storageMode !== 'server')
    return (
      <Card className="vx-anim-up p-5 text-sm text-ink-2">
        This copy of the app stores data in this browser only, so server backups do not apply. Use <strong>Account menu → Export data (JSON)</strong> to keep a copy, and move to the server version for scheduled backups.
      </Card>
    )

  const runNow = async () => {
    if (running) return
    setRunning(true)
    try {
      const r = await remote.backupRun()
      if (r.body.ok) pushToast({ title: 'Backup written', message: `${r.body.name} — revision ${r.body.revision}.`, level: 'success' })
      else pushToast({ title: 'Backup failed', message: r.body.error, level: 'danger' })
    } catch {
      pushToast({ title: 'Backup failed', message: 'The server could not be reached.', level: 'danger' })
    } finally {
      setRunning(false)
      void load()
    }
  }

  const validate = async (file: File) => {
    setChecking(true)
    setValidation(null)
    setPicked(file)
    setImported(null)
    try {
      const r = await remote.validateBackup(file)
      if (r.body.ok) setValidation({ file: file.name, result: r.body })
      else pushToast({ title: 'Validation failed', message: r.body.error, level: 'danger' })
    } catch {
      pushToast({ title: 'Validation failed', message: 'The server could not be reached.', level: 'danger' })
    } finally {
      setChecking(false)
    }
  }

  const importNow = async () => {
    if (!picked || importing) return
    setConfirmImport(false)
    setImporting(true)
    try {
      const r = await remote.restoreBackup(picked)
      if (r.body.ok) {
        setImported(`${picked.name} is now this computer's data (saved ${fmtDateTime(r.body.exportedAt)}). The data that was here before was saved as a backup first.`)
        setValidation(null)
        // Sessions end with an import: sign in again with the same password.
        window.setTimeout(() => window.location.assign('/login'), 4000)
      } else pushToast({ title: 'Import failed', message: r.body.error, level: 'danger' })
    } catch {
      pushToast({ title: 'Import failed', message: 'The server could not be reached.', level: 'danger' })
    } finally {
      setImporting(false)
    }
  }

  const status = info?.status
  const healthy = !!status?.lastSuccessAt && (!status.lastFailureAt || status.lastFailureAt < status.lastSuccessAt)
  const behind = status?.lastSuccessRevision != null && info ? info.currentRevision - status.lastSuccessRevision : null
  const v = validation?.result

  return (
    <div className="space-y-4">
      <Card className="vx-anim-up overflow-hidden">
        <CardHead
          title="Backup & Restore"
          subtitle="Complete, portable archives of the server data. A saved record is in the database at once, but only reaches a backup at the next backup."
          icon={<Save className="h-4 w-4" />}
          actions={
            <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void load()}>
              Refresh
            </Button>
          }
        />
        <div className="space-y-4 p-5 text-sm">
          {error ? (
            <p role="alert" className="rounded-md bg-risk-wash px-3 py-2 text-risk ring-1 ring-inset ring-risk-edge">
              {error}
            </p>
          ) : null}
          {info ? (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="vx-mono-label">Stored backups</dt>
                <dd className="mt-1 break-words text-ink">{info.configured ? info.location : 'Not configured on this deployment'}</dd>
              </div>
              <div>
                <dt className="vx-mono-label">Last successful backup</dt>
                <dd className="mt-1 text-ink">{status?.lastSuccessAt ? `${fmtDateTime(status.lastSuccessAt)} · revision ${status.lastSuccessRevision}` : 'None yet'}</dd>
              </div>
              <div>
                <dt className="vx-mono-label">Health</dt>
                <dd className="mt-1">
                  {!info.configured ? (
                    <Badge tone="amber">Scheduled backups pending setup</Badge>
                  ) : healthy ? (
                    <Badge tone="green">{behind ? `Healthy · ${behind} change(s) since` : 'Healthy · up to date'}</Badge>
                  ) : status?.lastFailure ? (
                    <Badge tone="red">Last backup failed</Badge>
                  ) : (
                    <Badge tone="amber">No backup yet</Badge>
                  )}
                  {status?.lastFailure && !healthy ? <span className="mt-1 block text-xs text-risk">{status.lastFailure}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="vx-mono-label">Passwords in backups</dt>
                <dd className="mt-1 text-ink">{info.passphraseConfigured ? 'Encrypted with the backup passphrase' : 'Not included (no passphrase set)'}</dd>
              </div>
            </dl>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <a className="vx-btn vx-focus inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 font-medium text-accent-ink" href={remote.freshBackupUrl()}>
              <HardDriveDownload className="h-4 w-4" aria-hidden="true" />
              Download a fresh complete backup
            </a>
            {info?.configured ? (
              <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={running} onClick={() => void runNow()}>
                Back up now
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            A backup holds everything saved up to its export time; anything saved later is not in it.
            {info?.schedule ? ` Scheduled: ${info.schedule}.` : ''}
          </p>

          {info?.backups.length ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="vx-th">Archive</th>
                  <th className="vx-th">Exported</th>
                  <th className="vx-th text-right">Revision</th>
                  <th className="vx-th text-right">Size</th>
                  <th className="vx-th text-right">File</th>
                </tr>
              </thead>
              <tbody>
                {info.backups.slice(0, 20).map((b) => (
                  <tr key={b.name} className="vx-row">
                    <td className="vx-td vx-code text-xs">{b.name}</td>
                    <td className="vx-td">{b.exportedAt ? fmtDateTime(b.exportedAt) : '—'}</td>
                    <td className="vx-td text-right tabular-nums">{b.revision ?? '—'}</td>
                    <td className="vx-td text-right tabular-nums">{kb(b.size)}</td>
                    <td className="vx-td text-right">
                      <a className="vx-focus inline-flex items-center gap-1 rounded-xs font-medium text-accent-text hover:underline" href={remote.backupFileUrl(b.name)}>
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Card>

      <Card className="vx-anim-up overflow-hidden">
        <CardHead title="Import a backup" subtitle="Choose a backup file (.zip) — for example data prepared on another computer. It is checked first; nothing changes until you press Import." icon={<FileCheck2 className="h-4 w-4" />} />
        <div className="space-y-3 p-5 text-sm">
          <input
            ref={fileInput}
            type="file"
            accept=".zip,application/zip"
            aria-label="Backup file to import"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void validate(f)
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" icon={<FolderOpen className="h-4 w-4" />} loading={checking} onClick={() => fileInput.current?.click()}>
              {picked ? 'Choose another file…' : 'Choose backup file…'}
            </Button>
            <Button
              icon={<Upload className="h-4 w-4" />}
              loading={importing}
              onClick={() => {
                if (!picked || !v) {
                  setNeedFile(true)
                  fileInput.current?.click()
                } else if (v.valid && !v.preview.blockers.length) setConfirmImport(true)
              }}
            >
              Import
            </Button>
            <span className="min-w-0 truncate text-ink-2" translate="no">
              {picked ? picked.name : 'No file chosen'}
            </span>
          </div>
          {needFile && !picked ? (
            <p role="alert" aria-live="polite" className="text-warn">
              Choose a backup file (.zip) first — then press Import.
            </p>
          ) : null}
          {checking ? <p role="status">Checking…</p> : null}
          {validation && v && !v.valid ? (
            <p role="alert" className="rounded-md bg-risk-wash px-3 py-2 text-risk ring-1 ring-inset ring-risk-edge">
              {validation.file}: {v.error}
            </p>
          ) : null}
          {validation && v && v.valid ? (
            <div className="space-y-2 rounded-md bg-surface-2 p-3">
              <p className="font-medium text-ink">
                {validation.file}: valid archive · revision {v.manifest.revision} · exported {fmtDateTime(v.manifest.exportedAt)}
              </p>
              <p className="text-xs text-muted">{v.manifest.notice}</p>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {COUNT_LABELS.map(([k, label]) => (
                  <div key={k}>
                    <dt className="vx-mono-label">{label}</dt>
                    <dd className="tabular-nums text-ink">{v.preview.archive.counts[k] ?? 0}</dd>
                  </div>
                ))}
              </dl>
              <p>{v.preview.destination.empty ? 'This computer has no data yet.' : 'The data now on this computer will be replaced — it is saved as a backup first, so nothing is lost.'}</p>
              {[...v.warnings, ...v.preview.blockers].map((w) => (
                <p key={w} className="text-warn">
                  {w}
                </p>
              ))}
              {v.preview.blockers.length ? null : (
                <p className="pt-1 font-medium text-ok">Ready — press Import. It replaces the data on this computer; the current data is backed up first and your passwords stay the same.</p>
              )}
            </div>
          ) : null}
          {imported ? (
            <p role="status" className="rounded-md bg-ok-wash px-3 py-2 text-ok ring-1 ring-inset ring-ok-edge">
              {imported} Opening the sign-in page…
            </p>
          ) : null}
          <ConfirmDialog
            open={confirmImport}
            tone="danger"
            title="Import this backup?"
            body={`The data on this computer is replaced with the data in ${picked?.name ?? 'the backup'}. The current data is saved as a backup first, so this can be undone by importing that backup. Everyone signs in again afterwards.`}
            confirmLabel="Import"
            onCancel={() => setConfirmImport(false)}
            onConfirm={() => void importNow()}
          />
        </div>
      </Card>
    </div>
  )
}
