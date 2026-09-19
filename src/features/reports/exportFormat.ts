import { useCallback, useState } from 'react'
import type { ExportFormat } from '../../lib/reportTable'

/* The spreadsheet download format is a per-computer preference: Excel (.xlsx)
   unless someone switches it to CSV in Reports → Settings. */
const KEY = 'vx.reports.exportFormat'

function readFormat(): ExportFormat {
  try {
    return localStorage.getItem(KEY) === 'csv' ? 'csv' : 'xlsx'
  } catch {
    return 'xlsx'
  }
}

export function useExportFormat(): [ExportFormat, (f: ExportFormat) => void] {
  const [format, setFormat] = useState<ExportFormat>(readFormat)
  const update = useCallback((f: ExportFormat) => {
    setFormat(f)
    try {
      localStorage.setItem(KEY, f)
    } catch {
      /* storage blocked — the choice still applies until the page is closed */
    }
  }, [])
  return [format, update]
}

export const FORMAT_LABEL: Record<ExportFormat, string> = { xlsx: 'Excel', csv: 'CSV' }
